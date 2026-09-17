/**
 * Build-time snapshot. Two jobs:
 *  1. run the same buildMetrics() the edge function runs, so the static HTML
 *     ships with real numbers (first paint + SEO);
 *  2. compute the slow-moving series that are too expensive to fetch per request
 *     — the full monthly-return matrix and the multi-coin board.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { buildMetrics } from '../functions/_lib/metrics.js';
import { buildEtf, buildAltseason, buildOptions } from '../functions/_lib/extras.js';
import { fetchNews } from '../functions/_lib/news.js';
import {
	fullDaily, btcAnalytics, monthlyMatrix, coinAnalytics, chainTvl, CHAIN_SLUG,
} from '../functions/_lib/btc-analytics.js';
import { onchain } from '../functions/_lib/onchain.js';
import { treasuries } from '../functions/_lib/treasuries.js';

const J = async (u) => {
	const r = await fetch(u);
	if (!r.ok) throw new Error(`${u} -> ${r.status}`);
	return r.json();
};

/** OHLCV for the interactive chart. Compact tuples keep the payload small. */
const CHART_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE'];

async function ohlcv(sym) {
	const rows = await J(
		`https://data-api.binance.vision/api/v3/klines?symbol=${sym}USDT&interval=1d&limit=420`,
	);
	const p = (v) => {
		const n = +v;
		return n >= 100 ? Math.round(n) : n >= 1 ? +n.toFixed(2) : +n.toFixed(5);
	};
	return rows.map((r) => [r[0], p(r[1]), p(r[2]), p(r[3]), p(r[4]), Math.round(+r[7] / 1e6)]);
}

const BOARD = [
	'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
	'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT', 'SUIUSDT', 'DOTUSDT',
	'LTCUSDT', 'TRXUSDT', 'NEARUSDT', 'APTUSDT',
];

async function board() {
	const q = encodeURIComponent(JSON.stringify(BOARD));
	const rows = await J(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${q}`);
	// 7-day shape per row, for the inline sparkline
	const spark = Object.fromEntries(
		await Promise.all(
			BOARD.map(async (s) => {
				try {
					const k = await J(
						`https://data-api.binance.vision/api/v3/klines?symbol=${s}&interval=4h&limit=42`,
					);
					const closes = k.map((r) => +r[4]);
					const lo = Math.min(...closes), hi = Math.max(...closes);
					// normalise to 0-100 so the client needs no scale maths
					return [s.replace('USDT', ''), closes.map((c) => +(((c - lo) / (hi - lo || 1)) * 100).toFixed(1))];
				} catch {
					return [s.replace('USDT', ''), []];
				}
			}),
		),
	);
	return rows
		.map((d) => ({
			sym: d.symbol.replace('USDT', ''),
			price: +d.lastPrice,
			chg: +d.priceChangePercent,
			high: +d.highPrice,
			low: +d.lowPrice,
			volB: +d.quoteVolume / 1e9,
			spark: spark[d.symbol.replace('USDT', '')] ?? [],
		}))
		.sort((a, b) => b.volB - a.volB);
}

const out = 'src/data/btc.json';
try {
	const [data, daily, brd, charts, news] = await Promise.all([
		buildMetrics(),
		fullDaily(),
		board(),
		Promise.all(CHART_COINS.map((c) => ohlcv(c))).then((all) =>
			Object.fromEntries(CHART_COINS.map((c, i) => [c, all[i]])),
		),
		fetchNews(200).catch(() => ({ items: [], errors: ['snapshot fetch failed'] })),
	]);
	if (news.errors?.length) console.warn('[snapshot] news:', news.errors.join(' | '));

	// RSS only exposes the newest N items, so a single pull can't reach back a
	// week. Merge each run into a rolling archive instead; the window fills in
	// on its own as the site gets rebuilt.
	const ARCHIVE = 'src/data/news-archive.json';
	const WINDOW_DAYS = 7;
	let archive = [];
	if (existsSync(ARCHIVE)) {
		try { archive = JSON.parse(readFileSync(ARCHIVE, 'utf8')).items ?? []; } catch {}
	}
	const cutoff = Date.now() - WINDOW_DAYS * 86400000;
	const merged = new Map();
	for (const it of [...archive, ...news.items]) {
		if (it.ts < cutoff) continue;
		const k = it.link || it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 42);
		const prev = merged.get(k);
		// keep the earliest sighting so a re-publish doesn't reset the timestamp
		if (!prev || it.ts < prev.ts) merged.set(k, it);
	}
	const rolling = [...merged.values()].sort((a, b) => b.ts - a.ts);
	writeFileSync(ARCHIVE, JSON.stringify({ updated: Date.now(), items: rolling }));
	data.news = rolling;
	const days = new Set(rolling.map((i) => new Date(i.ts).toISOString().slice(0, 10)));
	console.log(`[snapshot] news archive: ${rolling.length} items across ${days.size} days (+${news.items.length} fetched)`);
	data.charts = charts;
	data.monthly = monthlyMatrix(daily);
	data.btc = btcAnalytics(daily);

	// per-coin pages: each gets its own analytics plus its chain's TVL history
	const COIN_PAGES = ['BTC', 'ETH', 'SOL', 'BNB'];
	data.coins = {};
	for (const sym of COIN_PAGES) {
		try {
			const bars = sym === 'BTC' ? daily : await fullDaily(`${sym}USDT`);
			const a = coinAnalytics(bars, sym === 'BTC' ? null : daily);
			if (sym === 'BTC') Object.assign(a, btcAnalytics(daily));
			const slug = CHAIN_SLUG[sym];
			if (slug) a.tvl = await chainTvl(slug);
			a.price = bars.at(-1).c;
			// charts render a few hundred pixels wide; daily points are wasted bytes
			const thin = (arr, keep) =>
				Array.isArray(arr) ? arr.filter((_, i) => i % keep === 0 || i === arr.length - 1) : arr;
			if (a.drawdown?.series) a.drawdown.series = thin(a.drawdown.series, 3);
			if (a.ratio?.series) a.ratio.series = thin(a.ratio.series, 3);
			if (a.tvl?.series) a.tvl.series = thin(a.tvl.series, 2);
			if (a.mayer?.series) a.mayer.series = thin(a.mayer.series, 2);
			if (a.puell?.series) a.puell.series = thin(a.puell.series, 2);
			if (a.cycles) a.cycles = a.cycles.map((c) => ({ ...c, points: thin(c.points, 2) }));
			// each coin page imports only its own file
			writeFileSync(`src/data/coins/${sym.toLowerCase()}.json`, JSON.stringify(a));
			data.coins[sym] = { price: a.price, drawdown: a.drawdown.now, hasTvl: Boolean(a.tvl) };
		} catch (e) {
			console.warn(`[snapshot] coin ${sym}: ${e.message}`);
		}
	}
	data.board = brd;
	data.firstBar = daily[0]?.t ?? null;

	// The ETF tape, the altcoin-season ratio and the Deribit surface are daily
	// enough to bake in. Each one failing is survivable — the panel that reads
	// it degrades on its own rather than taking the build down.
	// Run these one after another. Together they are another ~70 requests, and
	// firing them alongside each other is what exhausts the connection pool.
	const etf = await buildEtf().catch((e) => ({ funds: [], errors: [e.message] }));
	const altseason = await buildAltseason().catch((e) => ({ errors: [e.message] }));
	const options = await buildOptions().catch((e) => ({ errors: [e.message] }));
	data.etf = etf;
	data.altseason = altseason;
	data.options = options;
	for (const [k, v] of Object.entries({ etf, altseason, options }))
		if (v.errors?.length) console.warn(`[snapshot] ${k}:`, v.errors.slice(0, 3).join(' | '));
	console.log(
		`[snapshot] etf ${etf.funds?.length ?? 0} funds · altseason ${altseason.value ?? 'n/a'} ` +
			`(${altseason.beating ?? '?'}/${altseason.counted ?? '?'}) · options p/c ${options.pcOi ?? 'n/a'} ` +
			`dvol ${options.dvolNow ?? 'n/a'}`,
	);

	// Chain state and treasury filings. These three panels fetch in the browser,
	// but a reader whose network can't reach Blockchair or CoinGecko — or who
	// arrives while CoinGecko is rate-limiting — would otherwise get an empty
	// table. Baking a value in means the panel always has something to show and
	// the live fetch is an upgrade rather than the only path to content.
	const chain = await onchain().catch((e) => {
		console.warn('[snapshot] onchain:', e.message);
		return undefined;
	});
	if (chain) data.onchain = chain;
	const books = {};
	for (const coin of ['BTC', 'ETH']) {
		try {
			books[coin] = await treasuries(coin);
		} catch (e) {
			console.warn(`[snapshot] treasuries ${coin}:`, e.message);
		}
	}
	if (Object.keys(books).length) data.treasuries = books;
	console.log(
		`[snapshot] chain ${chain ? Math.round(chain.chain.hashrateEh) + ' EH/s · hashprice $' + chain.miner.hashprice.toFixed(2) : 'n/a'}` +
			` · treasuries ${Object.keys(books).join('/') || 'n/a'}`,
	);

	// A single upstream hiccup (CoinGecko rate-limiting is the usual one) used to
	// write the key away entirely and take the whole build down with it. Carry the
	// last good value forward instead, and say which ones are stale.
	if (existsSync(out)) {
		try {
			const prev = JSON.parse(readFileSync(out, 'utf8'));
			const carried = Object.keys(prev).filter((k) => data[k] === undefined);
			for (const k of carried) data[k] = prev[k];
			if (carried.length) console.warn(`[snapshot] carried over from last run: ${carried.join(', ')}`);
		} catch {}
	}
	if (data.errors?.length) console.warn('[snapshot] partial:', data.errors.join(' | '));
	writeFileSync(out, JSON.stringify(data));
	console.log(
		`[snapshot] price ${data.price} · ahr999 ${data.ahr999?.value?.toFixed(3)} · ` +
			`${data.monthly.length} months · ${data.board.length} coins · ` +
			`${Object.keys(data.charts).length} ohlcv series · ${data.news.length} headlines · ` +
			`mayer ${data.btc.mayer.now} p${data.btc.mayer.pctile} · coins ${Object.keys(data.coins).join('/')}`,
	);
} catch (e) {
	console.warn('[snapshot] failed, keeping previous file:', e.message);
	process.exit(0);
}
