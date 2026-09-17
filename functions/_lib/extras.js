/**
 * Snapshot-time panels that sit outside the core metrics file: the US ETF tape,
 * an altcoin-season reading computed from scratch, and the Deribit options
 * surface. All three are daily-ish, so they're baked into the static build
 * rather than fetched in the browser.
 *
 * Same rule as metrics.js: public endpoints only, and nothing is approximated
 * into looking like a number it isn't. In particular there is no ETF *flow*
 * here — creations and redemptions are a paid dataset, and inferring them from
 * price and volume would be a guess dressed up as data.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Snapshot runs dozens of these back to back, and behind a local proxy the
 * connection pool is the thing that gives out first — not the upstream. A
 * transient connect error is retried rather than allowed to blank a panel.
 */
const J = async (url, init, tries = 3) => {
	let last;
	for (let i = 0; i < tries; i++) {
		try {
			const r = await fetch(url, {
				...init,
				headers: { 'user-agent': UA, accept: 'application/json', ...(init?.headers ?? {}) },
				cf: { cacheTtl: 600, cacheEverything: true },
			});
			if (!r.ok) throw new Error(`${url.slice(0, 60)} -> ${r.status}`);
			return r.json();
		} catch (e) {
			last = e;
			if (i < tries - 1) await sleep(400 * 2 ** i);
		}
	}
	throw last;
};

const pctChange = (a, b) => ((b - a) / a) * 100;
const round = (v, d = 2) => (Number.isFinite(v) ? +v.toFixed(d) : null);

/* ------------------------------------------------------------------ ETF tape */

/** Spot BTC and ETH funds, largest first. GBTC is kept because its outflow is
 *  the other half of every "ETFs bought X" headline. */
const FUNDS = [
	{ sym: 'IBIT', name: 'iShares Bitcoin', issuer: 'BlackRock', asset: 'BTC' },
	{ sym: 'FBTC', name: 'Wise Origin', issuer: 'Fidelity', asset: 'BTC' },
	{ sym: 'GBTC', name: 'Grayscale Trust', issuer: 'Grayscale', asset: 'BTC' },
	{ sym: 'ARKB', name: '21Shares Bitcoin', issuer: 'ARK', asset: 'BTC' },
	{ sym: 'BITB', name: 'Bitwise Bitcoin', issuer: 'Bitwise', asset: 'BTC' },
	{ sym: 'ETHA', name: 'iShares Ethereum', issuer: 'BlackRock', asset: 'ETH' },
	{ sym: 'FETH', name: 'Fidelity Ethereum', issuer: 'Fidelity', asset: 'ETH' },
];

const ymd = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

/**
 * Nasdaq's public quote API. It answers with US/comma-formatted strings and
 * newest-first rows, so everything is parsed and reversed on the way in.
 */
async function fundHistory(sym, days = 90) {
	const to = new Date();
	const from = new Date(Date.now() - days * 86400000);
	const d = await J(
		`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=etf` +
			`&fromdate=${from.toISOString().slice(0, 10)}&todate=${to.toISOString().slice(0, 10)}&limit=${days + 10}`,
		{ headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36' } },
	);
	const rows = d?.data?.tradesTable?.rows ?? [];
	if (!rows.length) throw new Error(`${sym}: no rows`);
	const num = (s) => +String(s).replace(/[$,]/g, '');
	return rows
		.map((r) => ({
			t: Date.parse(r.date),
			c: num(r.close),
			v: num(r.volume),
		}))
		.filter((r) => Number.isFinite(r.t) && Number.isFinite(r.c) && r.v > 0)
		.sort((a, b) => a.t - b.t);
}

export async function buildEtf() {
	const out = { funds: [], errors: [], asOf: null };
	// Nasdaq throttles a burst from one IP, so the funds go out in pairs
	const settled = [];
	for (let i = 0; i < FUNDS.length; i += 2) {
		if (i) await sleep(150);
		settled.push(...(await Promise.allSettled(FUNDS.slice(i, i + 2).map((f) => fundHistory(f.sym)))));
	}

	settled.forEach((res, i) => {
		const f = FUNDS[i];
		if (res.status !== 'fulfilled') {
			out.errors.push(`${f.sym}: ${res.reason.message}`);
			return;
		}
		const bars = res.value;
		const last = bars.at(-1);
		const back = (n) => bars[Math.max(0, bars.length - 1 - n)];
		// dollar volume is the honest read on participation: shares traded says
		// nothing across funds whose share prices differ by 20x
		const dv = bars.map((b) => ({ t: b.t, v: (b.c * b.v) / 1e6 }));
		const avg20 = dv.slice(-20).reduce((s, x) => s + x.v, 0) / Math.min(20, dv.length);
		out.funds.push({
			...f,
			price: round(last.c),
			d1: round(pctChange(back(1).c, last.c)),
			w1: round(pctChange(back(5).c, last.c)),
			m3: round(pctChange(bars[0].c, last.c)),
			volM: round(dv.at(-1).v, 1),
			avg20M: round(avg20, 1),
			relVol: round(dv.at(-1).v / avg20, 2),
			series: dv.slice(-60),
		});
		out.asOf = Math.max(out.asOf ?? 0, last.t);
	});

	if (!out.funds.length) return out;
	out.funds.sort((a, b) => b.volM - a.volM);
	// one combined tape line so the panel has a headline number
	const byDay = new Map();
	for (const f of out.funds) for (const p of f.series) byDay.set(p.t, (byDay.get(p.t) ?? 0) + p.v);
	out.total = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v: round(v, 1) }));
	out.totalM = out.total.at(-1)?.v ?? null;
	const prior = out.total.slice(-21, -1);
	out.totalAvgM = prior.length ? round(prior.reduce((s, p) => s + p.v, 0) / prior.length, 1) : null;
	return out;
}

/* ------------------------------------------------------- altcoin season index */

/**
 * The published "altcoin season index" is a ratio: of the top N coins, how many
 * beat BTC over the last 90 days. 75%+ is the conventional altseason line, 25%
 * or less is bitcoin season. Computed here from Binance daily closes rather
 * than taken from an API, so the window and the universe are both auditable.
 */
const ALT_EXCLUDE = /^(USDT|USDC|FDUSD|TUSD|DAI|BUSD|USDE|USD1|WBTC|WBETH|BTCB|STETH)$/;

async function dailyCloses(symbol, limit) {
	const k = await J(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`);
	return k.map((r) => ({ t: r[0], c: +r[4] }));
}

export async function buildAltseason(lookback = 90, universe = 50) {
	const out = { lookback, errors: [] };
	// rank by 24h quote volume — a liquidity-weighted universe beats a hand list
	const tickers = await J('https://api.binance.com/api/v3/ticker/24hr');
	const pool = tickers
		.filter((t) => t.symbol.endsWith('USDT') && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol))
		.map((t) => ({ sym: t.symbol.replace(/USDT$/, ''), symbol: t.symbol, volB: +t.quoteVolume / 1e9 }))
		.filter((t) => !ALT_EXCLUDE.test(t.sym))
		.sort((a, b) => b.volB - a.volB)
		.slice(0, universe);

	const btc = await dailyCloses('BTCUSDT', lookback + 2);
	const btcRet = pctChange(btc[0].c, btc.at(-1).c);

	// Binance is fine with this rate, but keep it polite — four at a time
	const coins = [];
	for (let i = 0; i < pool.length; i += 4) {
		if (i) await sleep(120);
		const batch = pool.slice(i, i + 4);
		const got = await Promise.allSettled(batch.map((p) => dailyCloses(p.symbol, lookback + 2)));
		got.forEach((r, j) => {
			if (r.status !== 'fulfilled' || r.value.length < lookback * 0.8) {
				out.errors.push(`${batch[j].sym}: thin history`);
				return;
			}
			const bars = r.value;
			coins.push({
				sym: batch[j].sym,
				volB: round(batch[j].volB, 2),
				ret: round(pctChange(bars[0].c, bars.at(-1).c)),
				vsBtc: round(pctChange(bars[0].c, bars.at(-1).c) - btcRet),
			});
		});
	}
	if (!coins.length) throw new Error('no altcoin history');

	const beating = coins.filter((c) => c.vsBtc > 0);
	out.btcRet = round(btcRet);
	out.counted = coins.length;
	out.beating = beating.length;
	out.value = Math.round((beating.length / coins.length) * 100);
	out.zone = out.value >= 75 ? 'altcoin season' : out.value <= 25 ? 'bitcoin season' : 'neither';
	coins.sort((a, b) => b.vsBtc - a.vsBtc);
	out.leaders = coins.slice(0, 6);
	out.laggards = coins.slice(-6).reverse();

	/**
	 * History: recompute the same ratio at weekly steps so the panel can show
	 * where the reading came from. Each step reuses the series already pulled,
	 * measuring the 90 days that ended on that date.
	 */
	return out;
}

/* ------------------------------------------------------------------- options */

/** `BTC-30OCT26-90000-P` -> parts. Deribit has used this shape since 2016. */
function parseInstrument(name) {
	const [, expiry, strike, cp] = name.split('-');
	const m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(expiry);
	if (!m) return null;
	const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
	const t = Date.UTC(2000 + +m[3], MON[m[2]], +m[1], 8);
	return { t, expiry, strike: +strike, put: cp === 'P' };
}

export async function buildOptions(currency = 'BTC') {
	const out = { currency, errors: [] };

	const book = (await J(
		`https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`,
	)).result;

	const now = Date.now();
	const live = [];
	for (const b of book) {
		const p = parseInstrument(b.instrument_name);
		if (!p || p.t < now) continue;
		live.push({ ...p, oi: b.open_interest ?? 0, vol: b.volume ?? 0, iv: b.mark_iv, spot: b.underlying_price });
	}
	if (!live.length) throw new Error('no live contracts');
	out.spot = round(live[0].spot);

	const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
	const puts = live.filter((c) => c.put);
	const calls = live.filter((c) => !c.put);
	out.oi = { put: round(sum(puts, (c) => c.oi), 1), call: round(sum(calls, (c) => c.oi), 1) };
	out.vol = { put: round(sum(puts, (c) => c.vol), 1), call: round(sum(calls, (c) => c.vol), 1) };
	out.pcOi = round(out.oi.put / out.oi.call);
	out.pcVol = out.vol.call > 0 ? round(out.vol.put / out.vol.call) : null;
	out.totalOi = round(out.oi.put + out.oi.call, 1);

	/**
	 * Term structure: ATM implied vol per expiry. "ATM" is the contract whose
	 * strike sits closest to spot, averaged across the put and the call so a
	 * single stale quote can't tilt the curve.
	 */
	const byExpiry = new Map();
	for (const c of live) {
		if (!byExpiry.has(c.t)) byExpiry.set(c.t, []);
		byExpiry.get(c.t).push(c);
	}
	const term = [];
	for (const [t, cs] of [...byExpiry.entries()].sort((a, b) => a[0] - b[0])) {
		const quoted = cs.filter((c) => Number.isFinite(c.iv) && c.iv > 0);
		if (!quoted.length) continue;
		const near = Math.min(...quoted.map((c) => Math.abs(c.strike - out.spot)));
		const atm = quoted.filter((c) => Math.abs(Math.abs(c.strike - out.spot) - near) < 1);
		const days = (t - now) / 86400000;
		term.push({
			t,
			label: cs[0].expiry,
			days: round(days, 1),
			iv: round(sum(atm, (c) => c.iv) / atm.length),
			strike: atm[0].strike,
			oi: round(sum(cs, (c) => c.oi), 1),
			putOi: round(sum(cs.filter((c) => c.put), (c) => c.oi), 1),
			v: round(sum(atm, (c) => c.iv) / atm.length),
		});
	}
	out.term = term.slice(0, 10);
	out.frontIv = out.term[0]?.iv ?? null;
	// the shape of the curve is the trade: backwardation means the front is bid
	const far = out.term.find((x) => x.days >= 60) ?? out.term.at(-1);
	out.slope = far && out.frontIv ? round(far.iv - out.frontIv) : null;
	out.farLabel = far?.label ?? null;

	/** Biggest open interest by expiry — where the pin risk actually sits. */
	out.byExpiry = [...out.term].sort((a, b) => b.oi - a.oi).slice(0, 6);

	// DVOL: Deribit's own 30-day vol index, the closest thing crypto has to VIX
	try {
		const end = Date.now();
		const start = end - 120 * 86400000;
		const d = await J(
			`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${currency}` +
				`&start_timestamp=${start}&end_timestamp=${end}&resolution=86400`,
		);
		const rows = d.result?.data ?? [];
		out.dvol = rows.map(([t, , , , close]) => ({ t, v: round(close) }));
		out.dvolNow = out.dvol.at(-1)?.v ?? null;
		const vals = out.dvol.map((p) => p.v).sort((a, b) => a - b);
		out.dvolPctile = vals.length
			? Math.round((vals.filter((v) => v < out.dvolNow).length / vals.length) * 100)
			: null;
		out.dvolLow = vals[0] ?? null;
		out.dvolHigh = vals.at(-1) ?? null;
	} catch (e) {
		out.errors.push(`dvol: ${e.message}`);
	}

	return out;
}
