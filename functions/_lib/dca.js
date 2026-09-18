/**
 * The standing order, priced against now.
 *
 * Split from the import script on purpose. The exchange export lives on one
 * laptop and carries order ids, so it is parsed once into a de-identified fill
 * list that ships with the repo; everything derived from it — averages, the two
 * curves, per-fill P&L — is recomputed on the six-hourly run against fresh
 * closes. Otherwise every price on the page would be frozen at whenever the CSV
 * was last imported, and a "current" column that never moves is worse than none.
 *
 * The comparison is the reason the page exists. A six-month return on crypto
 * describes the market; the same money bought on day one is what makes it a
 * claim about the method.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = { headers: { 'user-agent': UA, accept: 'application/json' }, cf: { cacheTtl: 900, cacheEverything: true } };
const DAY = 86400000;

export const KLINE_URL = (sym, start) =>
	`https://data-api.binance.vision/api/v3/klines?symbol=${sym}USDT&interval=1d&startTime=${start}&limit=400`;

const J = async (url) => {
	const r = await fetch(url, opts);
	if (!r.ok) throw new Error(`${url} -> ${r.status}`);
	return r.json();
};

/**
 * @param fills de-identified buys: { t, sym, qty, px, usdt }
 */
export async function buildDca(fills, { recent = 30 } = {}) {
	if (!fills?.length) throw new Error('no fills');
	const rows = [...fills].sort((a, b) => a.t - b.t);
	const syms = [...new Set(rows.map((f) => f.sym))];
	const t0 = rows[0].t, t1 = rows.at(-1).t;
	const startDay = Math.floor(t0 / DAY) * DAY;

	// sequential: six daily series at once exhausts the connection pool
	const series = {};
	for (const s of syms) series[s] = (await J(KLINE_URL(s, startDay))).map((k) => [k[0], +k[4]]);
	const closeOn = (s, t) => {
		let v = series[s][0][1];
		for (const [kt, c] of series[s]) { if (kt > t) break; v = c; }
		return v;
	};
	const spot = Object.fromEntries(syms.map((s) => [s, series[s].at(-1)[1]]));

	const spent = rows.reduce((a, f) => a + f.usdt, 0);
	const held = {}, weight = {}, firstPx = {}, count = {};
	for (const f of rows) {
		held[f.sym] = (held[f.sym] ?? 0) + f.qty;
		weight[f.sym] = (weight[f.sym] ?? 0) + f.usdt;
		count[f.sym] = (count[f.sym] ?? 0) + 1;
		if (!(f.sym in firstPx)) firstPx[f.sym] = f.px;
	}
	const value = syms.reduce((a, s) => a + held[s] * spot[s], 0);

	// the alternative: the whole amount on day one, same split
	const lumpQty = Object.fromEntries(syms.map((s) => [s, weight[s] / firstPx[s]]));
	const lumpValue = syms.reduce((a, s) => a + lumpQty[s] * spot[s], 0);

	const curve = [];
	for (let d = startDay; d <= Date.now(); d += DAY) {
		const upto = rows.filter((f) => f.t <= d + DAY - 1);
		const inv = upto.reduce((a, f) => a + f.usdt, 0);
		if (!inv) continue;
		const pos = {};
		for (const f of upto) pos[f.sym] = (pos[f.sym] ?? 0) + f.qty;
		const mv = Object.keys(pos).reduce((a, s) => a + pos[s] * closeOn(s, d), 0);
		const lump = syms.reduce((a, s) => a + lumpQty[s] * closeOn(s, d), 0);
		// both as a return on the same total, so one axis carries them honestly
		curve.push({
			t: d,
			dca: +((mv / inv - 1) * 100).toFixed(2),
			lump: +((lump / spent - 1) * 100).toFixed(2),
		});
	}

	const dp = (v) => (v >= 1 ? 2 : 4);
	const perSym = syms
		.map((s) => {
			const avg = weight[s] / held[s];
			return {
				sym: s, buys: count[s],
				invested: +weight[s].toFixed(2),
				// full precision: this is multiplied by a live price in the browser
				qty: +held[s].toFixed(8),
				avg: +avg.toFixed(dp(avg)),
				spot: +spot[s].toFixed(dp(spot[s])),
				value: +(held[s] * spot[s]).toFixed(2),
				pnl: +(held[s] * spot[s] - weight[s]).toFixed(2),
				ret: +((spot[s] / avg - 1) * 100).toFixed(1),
			};
		})
		.sort((a, b) => b.invested - a.invested);

	// every buy priced against now — the table that makes the average checkable
	const fillsOut = rows.map((f) => ({
		t: f.t, sym: f.sym,
		qty: +f.qty.toFixed(8),
		px: +f.px.toFixed(dp(f.px)),
		usdt: +f.usdt.toFixed(2),
		pnl: +(f.qty * spot[f.sym] - f.usdt).toFixed(2),
		ret: +((spot[f.sym] / f.px - 1) * 100).toFixed(1),
	}));
	const winners = fillsOut.filter((f) => f.pnl > 0).length;

	return {
		source: 'Binance spot order export',
		pricedAt: Date.now(),
		from: new Date(t0).toISOString().slice(0, 10),
		to: new Date(t1).toISOString().slice(0, 10),
		buys: rows.length,
		invested: +spent.toFixed(2),
		value: +value.toFixed(2),
		ret: +((value / spent - 1) * 100).toFixed(2),
		lumpValue: +lumpValue.toFixed(2),
		lumpRet: +((lumpValue / spent - 1) * 100).toFixed(2),
		edge: +(((value - lumpValue) / spent) * 100).toFixed(2),
		weightedDays: Math.round(rows.reduce((a, f) => a + f.usdt * ((t1 - f.t) / DAY), 0) / spent),
		spanDays: Math.round((t1 - t0) / DAY),
		fillsInProfit: winners,
		fillsInLoss: fillsOut.length - winners,
		perSym,
		recent: fillsOut.slice(-recent).reverse(),
		curve,
	};
}
