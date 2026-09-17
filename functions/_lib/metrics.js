/**
 * Every derived number on the dashboard is computed here, from public endpoints
 * only. Anything that would need paid on-chain data (MVRV, SOPR, NUPL) is
 * deliberately absent rather than approximated.
 */
export const GENESIS = Date.UTC(2009, 0, 3);
export const HALVING_INTERVAL = 210_000;

/** Binance answers 451 to the default Node/undici UA; a browser-ish one is fine. */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const J = async (url, init) => {
	const r = await fetch(url, {
		...init,
		headers: { 'user-agent': UA, accept: 'application/json', ...(init?.headers ?? {}) },
		cf: { cacheTtl: 120, cacheEverything: true },
	});
	if (!r.ok) throw new Error(`${url} -> ${r.status}`);
	return r.json();
};

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const stdev = (a) => {
	const m = mean(a);
	return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

/** Equal-dollar DCA cost is the harmonic mean, not the arithmetic one. */
const harmonic = (a) => a.length / a.reduce((s, x) => s + 1 / x, 0);

export async function buildMetrics() {
	const out = { ts: Date.now(), errors: [] };

	// ---- price history: daily (1000) and weekly (for the 200w) ----
	let daily = [];
	let weekly = [];
	try {
		const [d, w] = await Promise.all([
			J('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000'),
			J('https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=300'),
		]);
		daily = d.map((r) => ({ t: r[0], c: +r[4] }));
		weekly = w.map((r) => ({ t: r[0], c: +r[4] }));
	} catch (e) {
		out.errors.push(`klines: ${e.message}`);
	}

	if (daily.length) {
		const closes = daily.map((x) => x.c);
		const px = closes.at(-1);
		out.price = px;

		const chg = (n) => (closes.length > n ? (px / closes.at(-1 - n) - 1) * 100 : null);
		out.chg = { d1: chg(1), d7: chg(7), d30: chg(30), d365: chg(365) };

		const last200 = closes.slice(-200);
		out.ma200d = mean(last200);
		out.ma200dDev = (px / out.ma200d - 1) * 100;

		// AHR999 = (price / 200d DCA cost) x (price / exponential growth valuation)
		const dca = harmonic(last200);
		const ageDays = Math.floor((Date.now() - GENESIS) / 86400000);
		const growth = 10 ** (5.84 * Math.log10(ageDays) - 17.01);
		out.ahr999 = { value: (px / dca) * (px / growth), dca, growth, ageDays };

		// realized volatility, annualized
		const rets = [];
		for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
		const rv = (n) => (rets.length >= n ? stdev(rets.slice(-n)) * Math.sqrt(365) * 100 : null);
		out.vol = { d30: rv(30), d90: rv(90), d365: rv(365) };

		// ---- series for the charts ----
		// 365 daily closes with a 200d mean overlay, thinned to keep the payload small
		const span = daily.slice(-365);
		const maAt = (i) => {
			const abs = daily.length - span.length + i;
			if (abs < 199) return null;
			return mean(closes.slice(abs - 199, abs + 1));
		};
		const step = 2; // ~183 points is plenty at chart width
		out.series = {
			price: span
				.map((d, i) => ({ t: d.t, c: +d.c.toFixed(0), m: maAt(i) ? +maAt(i).toFixed(0) : null }))
				.filter((_, i) => i % step === 0 || i === span.length - 1),
		};

		// monthly returns matrix for the heatmap
		const byMonth = new Map();
		for (const d of daily) {
			const dt = new Date(d.t);
			const k = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
			if (!byMonth.has(k)) byMonth.set(k, { o: d.c, c: d.c, y: dt.getUTCFullYear(), m: dt.getUTCMonth() });
			byMonth.get(k).c = d.c;
		}
		out.monthly = [...byMonth.values()].map((v) => ({
			y: v.y,
			m: v.m,
			r: +((v.c / v.o - 1) * 100).toFixed(1),
		}));

		// drawdown from the high inside the sample
		const ath = Math.max(...closes);
		out.ath = { price: ath, date: daily.find((x) => x.c === ath)?.t ?? null, drawdown: (px / ath - 1) * 100 };
	}

	if (weekly.length >= 200) {
		out.ma200w = mean(weekly.slice(-200).map((x) => x.c));
		if (out.price) out.ma200wMult = out.price / out.ma200w;
	}

	// ---- on-chain: height, difficulty, hashrate ----
	try {
		const s = (await J('https://api.blockchair.com/bitcoin/stats')).data;
		out.chain = {
			height: s.blocks,
			difficulty: s.difficulty,
			hashrateEH: Number(s.hashrate_24h) / 1e18,
			txs24h: s.transactions_24h,
			feeSatVb: s.suggested_transaction_fee_per_byte_sat,
		};
		const nextHalving = Math.ceil((s.blocks + 1) / HALVING_INTERVAL) * HALVING_INTERVAL;
		const blocksLeft = nextHalving - s.blocks;
		out.halving = {
			height: nextHalving,
			blocksLeft,
			days: (blocksLeft * 10) / 60 / 24,
			// subsidy after the next one
			subsidy: 50 / 2 ** (nextHalving / HALVING_INTERVAL),
		};
	} catch (e) {
		out.errors.push(`chain: ${e.message}`);
	}

	// ---- sentiment ----
	try {
		const f = await J('https://api.alternative.me/fng/?limit=2');
		out.fng = {
			value: +f.data[0].value,
			label: f.data[0].value_classification,
			prev: +f.data[1].value,
		};
	} catch (e) {
		out.errors.push(`fng: ${e.message}`);
	}

	// ---- dominance ----
	try {
		const g = (await J('https://api.coingecko.com/api/v3/global')).data;
		out.dominance = g.market_cap_percentage.btc;
		out.totalMcapT = g.total_market_cap.usd / 1e12;
	} catch (e) {
		out.errors.push(`global: ${e.message}`);
	}

	// ---- derivatives ----
	// Binance perps first; OKX carries the same three readings if that 451s.
	try {
		const [prem, oi, ls] = await Promise.all([
			J('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
			J('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT'),
			J('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1'),
		]);
		const rate = +prem.lastFundingRate;
		out.derivs = {
			venue: 'Binance',
			funding: rate * 100,
			fundingApr: rate * 3 * 365 * 100,
			oiBtc: +oi.openInterest,
			oiUsdB: (+oi.openInterest * (out.price ?? +prem.markPrice)) / 1e9,
			longShort: ls?.[0] ? +ls[0].longShortRatio : null,
		};
	} catch (e) {
		try {
			const [fr, oi, ls] = await Promise.all([
				J('https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP'),
				J('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP'),
				J('https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=1H'),
			]);
			const rate = +fr.data[0].fundingRate;
			const oiBtc = +oi.data[0].oiCcy;
			out.derivs = {
				venue: 'OKX',
				funding: rate * 100,
				fundingApr: rate * 3 * 365 * 100,
				oiBtc,
				oiUsdB: (oiBtc * (out.price ?? 0)) / 1e9,
				longShort: ls?.data?.[0] ? +ls.data[0][1] : null,
			};
			out.errors.push(`derivs: binance ${e.message}, used OKX`);
		} catch (e2) {
			out.errors.push(`derivs: ${e.message} | okx ${e2.message}`);
		}
	}

	return out;
}
