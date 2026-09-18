/**
 * The DCA record: 697 buys over six months, and what the same money would have
 * done bought all at once.
 *
 * The second number is the point. A six-month return of +24.6% on crypto says
 * almost nothing on its own — the market moved, and anyone holding made money.
 * What is worth publishing is the comparison against the honest alternative:
 * same money, same split, same market, bought on day one. That one is falsifiable,
 * and it is the only version of this a reader can argue with.
 *
 * Input is the exchange's own order export, which stays out of the repo because
 * it carries order ids. What ships is the aggregate and the two curves.
 *
 *   node scripts/dca.mjs <path-to-binance-order-export.csv>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
if (!SRC) {
	console.error('usage: node scripts/dca.mjs <binance-order-export.csv>');
	process.exit(1);
}

const UA = { headers: { 'user-agent': 'Mozilla/5.0 (compatible; thetapesays/1.0)', accept: 'application/json' } };
const DAY = 86400000;
const num = (s) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0;

/**
 * The export has two columns both called "时间" and mixes Filled/FILLED, so it
 * is read by position and compared case-insensitively. Reading it by header name
 * silently keeps the second date column and drops 98% of the rows.
 */
function parse(csv) {
	const rows = csv.replace(/^﻿/, '').trim().split('\n').slice(1);
	const out = [];
	for (const line of rows) {
		const c = line.split(',');
		if (c.length < 12 || c[11].trim().toLowerCase() !== 'filled') continue;
		out.push({
			t: Date.parse(c[0].slice(0, 19).replace(' ', 'T') + 'Z'),
			sym: c[2].replace(/USDT$/, ''),
			qty: num(c[8]),
			px: num(c[9]),
			usdt: num(c[10]),
		});
	}
	return out.sort((a, b) => a.t - b.t);
}

const klines = async (sym, startMs) => {
	const u = `https://data-api.binance.vision/api/v3/klines?symbol=${sym}USDT&interval=1d&startTime=${startMs}&limit=400`;
	const r = await fetch(u, UA);
	if (!r.ok) throw new Error(`${sym} -> ${r.status}`);
	return (await r.json()).map((k) => [k[0], +k[4]]);
};

const fills = parse(readFileSync(SRC, 'utf8'));
if (!fills.length) throw new Error('no filled rows parsed');

const syms = [...new Set(fills.map((f) => f.sym))];
const t0 = fills[0].t, t1 = fills.at(-1).t;
const startDay = Math.floor(t0 / DAY) * DAY;

// daily closes per symbol, sequential — six symbols at once trips the pool
const px = {};
for (const s of syms) px[s] = await klines(s, startDay);
const closeOn = (s, t) => {
	const rows = px[s];
	let v = rows[0][1];
	for (const [kt, c] of rows) { if (kt > t) break; v = c; }
	return v;
};
const spot = Object.fromEntries(syms.map((s) => [s, px[s].at(-1)[1]]));

// ---- what actually happened ----
const spent = fills.reduce((a, f) => a + f.usdt, 0);
const held = {};
for (const f of fills) held[f.sym] = (held[f.sym] ?? 0) + f.qty;
const value = syms.reduce((a, s) => a + held[s] * spot[s], 0);

// ---- the alternative: all of it on day one, same split ----
const weight = {};
for (const f of fills) weight[f.sym] = (weight[f.sym] ?? 0) + f.usdt;
const firstPx = {};
for (const f of fills) if (!(f.sym in firstPx)) firstPx[f.sym] = f.px;
const lumpQty = Object.fromEntries(syms.map((s) => [s, weight[s] / firstPx[s]]));
const lumpValue = syms.reduce((a, s) => a + lumpQty[s] * spot[s], 0);

// ---- both curves, daily ----
const curve = [];
for (let d = startDay; d <= Date.now(); d += DAY) {
	const upto = fills.filter((f) => f.t <= d + DAY - 1);
	const inv = upto.reduce((a, f) => a + f.usdt, 0);
	if (!inv) continue;
	const pos = {};
	for (const f of upto) pos[f.sym] = (pos[f.sym] ?? 0) + f.qty;
	const mv = Object.keys(pos).reduce((a, s) => a + pos[s] * closeOn(s, d), 0);
	const lump = syms.reduce((a, s) => a + lumpQty[s] * closeOn(s, d), 0);
	curve.push({
		t: d,
		invested: +inv.toFixed(2),
		value: +mv.toFixed(2),
		// both as return on the same total capital, so one axis carries both
		dca: +((mv / inv - 1) * 100).toFixed(2),
		lump: +((lump / spent - 1) * 100).toFixed(2),
	});
}

// money is only at work from the day it goes in; this is DCA's hidden cost
const weightedDays = fills.reduce((a, f) => a + f.usdt * ((t1 - f.t) / DAY), 0) / spent;

const perSym = syms
	.map((s) => ({
		sym: s,
		buys: fills.filter((f) => f.sym === s).length,
		invested: +weight[s].toFixed(2),
		avg: +(weight[s] / held[s]).toFixed(held[s] > 1000 ? 4 : 2),
		spot: spot[s],
		ret: +((spot[s] / (weight[s] / held[s]) - 1) * 100).toFixed(1),
	}))
	.sort((a, b) => b.invested - a.invested);

const out = {
	source: 'Binance spot order export',
	from: new Date(t0).toISOString().slice(0, 10),
	to: new Date(t1).toISOString().slice(0, 10),
	buys: fills.length,
	days: Math.round((t1 - t0) / DAY),
	invested: +spent.toFixed(2),
	value: +value.toFixed(2),
	ret: +((value / spent - 1) * 100).toFixed(2),
	lumpValue: +lumpValue.toFixed(2),
	lumpRet: +((lumpValue / spent - 1) * 100).toFixed(2),
	edge: +(((value - lumpValue) / spent) * 100).toFixed(2),
	weightedDays: Math.round(weightedDays),
	spanDays: Math.round((t1 - t0) / DAY),
	perSym,
	curve,
};

writeFileSync('src/data/dca.json', JSON.stringify(out));
console.log(
	`[dca] ${out.buys} buys ${out.from}→${out.to} · $${out.invested} in, $${out.value} now ` +
		`(${out.ret > 0 ? '+' : ''}${out.ret}%) · lump sum ${out.lumpRet > 0 ? '+' : ''}${out.lumpRet}% ` +
		`· edge ${out.edge > 0 ? '+' : ''}${out.edge}pp · money at work ${out.weightedDays}/${out.spanDays}d ` +
		`· ${out.curve.length} days of curve`,
);
