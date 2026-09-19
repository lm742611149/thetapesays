/**
 * Build the trade log from the Binance spot account, straight off the API.
 *
 * T2 moved from OKX to Binance on 2026-09-14, so the log now has two venues.
 * The OKX side is finished and frozen — it came from a CSV export and is kept
 * verbatim; everything from Binance is re-pulled from the API on every run, so
 * a rerun is idempotent and a mis-typed number cannot survive one.
 *
 *   node scripts/import-trades-binance.mjs [--write] [--stop ETH=2398.07,SOL=96.89]
 *
 * Credentials live in ~/.binance-t2-key (KEY=/SECRET= lines), never in the repo.
 * Requests go through curl: this machine runs a TLS-intercepting proxy that
 * Node's fetch refuses and curl accepts.
 *
 * Fills are matched FIFO per instrument, same convention as the OKX importer.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT = 'src/data/trades.json';
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
/** The venue split is a fact about the account, not a date we get to choose. */
const BINANCE_FROM = '2026-09-12';

const conf = Object.fromEntries(
	readFileSync(join(homedir(), '.binance-t2-key'), 'utf8')
		.split('\n').filter(Boolean).map((l) => l.split('=').map((s) => s.trim())),
);
const { BINANCE_KEY: KEY, BINANCE_SECRET: SECRET } = conf;
if (!KEY || !SECRET) throw new Error('~/.binance-t2-key is missing KEY or SECRET');

const curl = (url, headers = []) =>
	execFileSync('curl', ['-sS', '--max-time', '30', ...headers.flatMap((h) => ['-H', h]), url],
		{ encoding: 'utf8', maxBuffer: 8 << 20 });

/** Binance rejects a timestamp more than recvWindow off its own clock. */
const serverTime = () => JSON.parse(curl('https://api.binance.com/api/v3/time')).serverTime;

function signed(path, params, ts) {
	const q = `${params}&timestamp=${ts}&recvWindow=10000`;
	const sig = createHmac('sha256', SECRET).update(q).digest('hex');
	const body = curl(`https://api.binance.com${path}?${q}&signature=${sig}`, [`X-MBX-APIKEY: ${KEY}`]);
	const json = JSON.parse(body);
	if (json.code) throw new Error(`binance ${path}: ${json.code} ${json.msg}`);
	return json;
}

/**
 * Commission is charged in the coin on a buy and in USDT on a sell. Left in
 * mixed units it understates the cost of every entry, so the coin-side fee is
 * converted at the fill's own price — the only rate that is actually true for
 * that fill.
 */
function toFills(trades, sym) {
	return trades.map((t) => {
		const price = Number(t.price), qty = Number(t.qty), fee = Number(t.commission);
		const asset = t.commissionAsset;
		let feeUsdt;
		if (asset === 'USDT') feeUsdt = fee;
		else if (asset === sym) feeUsdt = fee * price;
		else throw new Error(`unhandled commission asset ${asset} on ${sym} trade ${t.id}`);
		return {
			ts: new Date(t.time).toISOString().replace('T', ' ').slice(0, 19),
			sym,
			side: t.isBuyer ? 'buy' : 'sell',
			qty,
			price,
			fee: feeUsdt,
		};
	});
}

/**
 * Same FIFO as scripts/import-trades.mjs: each sell closes the oldest open buy.
 * Binance splits one market order into several fills at one price, so buys are
 * folded per (order, price) first — otherwise eight partial fills of one SOL
 * entry would publish as eight trades.
 */
function fold(fills) {
	const out = new Map();
	for (const f of fills) {
		const k = `${f.ts}|${f.sym}|${f.side}|${f.price}`;
		const prev = out.get(k);
		if (prev) { prev.qty += f.qty; prev.fee += f.fee; }
		else out.set(k, { ...f });
	}
	return [...out.values()].map((f) => ({ ...f, qty: +f.qty.toPrecision(10), fee: +f.fee.toFixed(6) }))
		.sort((a, b) => a.ts.localeCompare(b.ts));
}

function pair(fills) {
	const openLots = new Map();
	const closed = [];
	for (const f of fills) {
		if (!openLots.has(f.sym)) openLots.set(f.sym, []);
		const lots = openLots.get(f.sym);
		if (f.side === 'buy') { lots.push({ ...f, openQty: f.qty }); continue; }
		let left = f.qty;
		while (left > 1e-12 && lots.length) {
			const lot = lots[0];
			const q = Math.min(left, lot.qty);
			const feeIn = lot.fee * (q / lot.qty);
			const feeOut = f.fee * (q / f.qty);
			const gross = q * (f.price - lot.price);
			closed.push({
				sym: f.sym,
				opened: lot.ts.slice(0, 10),
				closed: f.ts.slice(0, 10),
				held: Math.max(0, Math.round((Date.parse(f.ts.replace(' ', 'T') + 'Z') - Date.parse(lot.ts.replace(' ', 'T') + 'Z')) / 864e5)),
				qty: +q.toPrecision(8),
				entry: lot.price,
				exit: f.price,
				size: +(q * lot.price).toFixed(2),
				fees: +(feeIn + feeOut).toFixed(4),
				pnl: +(gross - feeIn - feeOut).toFixed(2),
				pnlPct: +(((gross - feeIn - feeOut) / (q * lot.price)) * 100).toFixed(2),
				venue: 'binance',
			});
			lot.qty -= q;
			lot.fee -= feeIn;
			left -= q;
			// The fee comes out of the coin, so a sell is always a hair smaller
			// than the buy it closes. That crumb is not a position.
			if (lot.qty <= lot.openQty * 0.02) lots.shift();
		}
	}
	const open = [];
	for (const [sym, lots] of openLots)
		for (const lot of lots)
			if (lot.qty > lot.openQty * 0.02)
				open.push({
					sym, opened: lot.ts.slice(0, 10), entry: lot.price,
					qty: +lot.qty.toPrecision(8), size: +(lot.qty * lot.price).toFixed(2),
					stop: null, venue: 'binance',
				});
	return { closed, open };
}

function drawdown(curve) {
	let peak = 0, worst = 0, worstPct = 0;
	for (const p of curve) {
		peak = Math.max(peak, p.cum);
		const dd = p.cum - peak;
		if (dd < worst) { worst = dd; worstPct = peak > 0 ? (dd / peak) * 100 : 0; }
	}
	return { abs: +worst.toFixed(2), pct: +worstPct.toFixed(1) };
}

const write = process.argv.includes('--write');
const stopArg = process.argv[process.argv.indexOf('--stop') + 1];
/** Stops are the signal's, not the exchange's — they come from the T2 worker. */
const stops = Object.fromEntries(
	(process.argv.includes('--stop') ? stopArg.split(',') : [])
		.map((kv) => kv.split('=')).map(([k, v]) => [k.trim(), Number(v)]),
);

const ts = serverTime();
const raw = SYMBOLS.flatMap((s) => toFills(signed('/api/v3/myTrades', `symbol=${s}&limit=500`, ts), s.replace(/USDT$/, '')));
const fills = fold(raw);
console.log(`[binance] ${raw.length} fills -> ${fills.length} orders across ${new Set(fills.map((f) => f.sym)).size} instruments`);

const bn = pair(fills);
for (const o of bn.open) if (stops[o.sym] != null) o.stop = stops[o.sym];

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
/** Anything that predates the move is the OKX record, kept exactly as exported. */
const okx = (prev.closed ?? []).filter((t) => t.closed < BINANCE_FROM).map((t) => ({ ...t, venue: t.venue ?? 'okx' }));

const closed = [...okx, ...bn.closed].sort((a, b) => a.closed.localeCompare(b.closed));
let cum = 0;
const curve = closed.map((t) => { cum += t.pnl; return { date: t.closed, sym: t.sym, pnl: t.pnl, cum: +cum.toFixed(2) }; });

const wins = closed.filter((t) => t.pnl > 0), losses = closed.filter((t) => t.pnl <= 0);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : null);
const r2 = (v) => (v == null ? null : +v.toFixed(2));
const grossWin = sum(wins.map((t) => t.pnl)), grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));

const out = {
	_comment: 'Generated by scripts/import-trades-binance.mjs from the exchange record. Do not hand-edit the trades.',
	verified: true,
	source: 'Binance spot · API · OKX spot export through 2026-09-11',
	since: closed[0]?.opened ?? null,
	through: closed.at(-1)?.closed ?? null,
	rules: prev.rules,
	stats: {
		trades: closed.length,
		wins: wins.length,
		losses: losses.length,
		winRate: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : null,
		netPnl: +sum(closed.map((t) => t.pnl)).toFixed(2),
		fees: +sum(closed.map((t) => t.fees)).toFixed(2),
		avgWin: r2(avg(wins.map((t) => t.pnlPct))),
		avgLoss: r2(avg(losses.map((t) => t.pnlPct))),
		profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
		avgHeld: r2(avg(closed.map((t) => t.held))),
		best: closed.length ? Math.max(...closed.map((t) => t.pnlPct)) : null,
		worst: closed.length ? Math.min(...closed.map((t) => t.pnlPct)) : null,
		avgSize: avg(closed.map((t) => t.size)) != null ? +avg(closed.map((t) => t.size)).toFixed(0) : null,
		drawdown: drawdown(curve),
	},
	curve,
	open: bn.open,
	closed,
};

const json = JSON.stringify(out, null, '\t') + '\n';
if (write) { writeFileSync(OUT, json); console.log(`[trades] wrote ${OUT}`); }
console.log(
	`[trades] ${closed.length} closed · ${wins.length}W/${losses.length}L · net ${out.stats.netPnl} USDT · ` +
		`PF ${out.stats.profitFactor} · maxDD ${out.stats.drawdown.abs} (${out.stats.drawdown.pct}%) · ${bn.open.length} open`,
);
for (const o of bn.open) console.log(`  open ${o.sym} ${o.qty} @ ${o.entry} = ${o.size}U · stop ${o.stop ?? '—'}`);
