/**
 * Build the trade log from an exchange export.
 *
 * The signal log is what the system said to do; this is what actually filled,
 * fees and all. They are not the same document and only the second one can be
 * published — reconciling an earlier hand-kept version against an OKX export
 * turned one recorded loss into a gain and showed a position that had already
 * been closed.
 *
 * Usage:  node scripts/import-trades.mjs <export-dir> [--write]
 *
 * Fills are matched FIFO per instrument: each sell closes the oldest open buy.
 * That is the right convention here because position size is fixed per entry,
 * so a partial close never splits a lot in practice.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'src/data/trades.json';
/** Rules are editorial, not derived — carried over from the existing file. */
const FALLBACK_RULES = [
	'Spot only. No leverage, no perpetuals, no margin.',
	'Entries and exits fire on a daily close, never intraday.',
	'Stop is written down at entry and is not moved down. Ever.',
	'Position size is a fixed slice of the pool, not a conviction call.',
	'Every fill gets posted, including the ones that lose. Especially those.',
];
/** Stablecoin pairs are treasury moves, not positions. */
const SKIP = /^(USDC|USDT|DAI|FDUSD|TUSD)-/;

/** OKX writes a BOM on every line, not just the first. */
function rows(csvText) {
	const lines = csvText.split(/\r?\n/).map((l) => l.replace(/﻿/g, '')).filter((l) => l.trim());
	// line 0 is an account header, line 1 is the real header
	const head = lines[1].split(',');
	return lines.slice(2).map((line) => {
		const cells = line.split(',');
		return Object.fromEntries(head.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]));
	});
}

function load(dir) {
	const file = readdirSync(dir).find((f) => f.includes('历史委托单') && f.endsWith('.csv'));
	if (!file) throw new Error(`no order-history csv in ${dir}`);
	return rows(readFileSync(join(dir, file), 'utf8'))
		.filter((r) => r['委托ID'] && r['状态'] === '完全成交')
		.filter((r) => !SKIP.test(r['交易品种']))
		.map((r) => ({
			ts: r['委托时间'],
			sym: r['交易品种'].split('-')[0],
			side: r['方向'].startsWith('买') ? 'buy' : 'sell',
			qty: Number(r['成交数量']),
			price: Number(r['成交均价']),
			fee: Math.abs(Number(r['手续费'] || 0)),
		}))
		.filter((f) => f.qty > 0 && f.price > 0)
		.sort((a, b) => a.ts.localeCompare(b.ts));
}

/** FIFO: each sell closes the oldest open buy on the same instrument. */
function pair(fills) {
	const openLots = new Map();
	const closed = [];
	for (const f of fills) {
		if (!openLots.has(f.sym)) openLots.set(f.sym, []);
		const lots = openLots.get(f.sym);
		if (f.side === 'buy') {
			lots.push({ ...f, openQty: f.qty });
			continue;
		}
		let left = f.qty;
		while (left > 1e-12 && lots.length) {
			const lot = lots[0];
			const q = Math.min(left, lot.qty);
			// fees are prorated so a partial close carries its share
			const feeIn = lot.fee * (q / lot.qty);
			const feeOut = f.fee * (q / f.qty);
			const gross = q * (f.price - lot.price);
			closed.push({
				sym: f.sym,
				opened: lot.ts.slice(0, 10),
				closed: f.ts.slice(0, 10),
				held: Math.max(
					0,
					Math.round((Date.parse(f.ts.replace(' ', 'T') + 'Z') - Date.parse(lot.ts.replace(' ', 'T') + 'Z')) / 864e5),
				),
				qty: +q.toPrecision(8),
				entry: lot.price,
				exit: f.price,
				size: +(q * lot.price).toFixed(2),
				fees: +(feeIn + feeOut).toFixed(4),
				pnl: +(gross - feeIn - feeOut).toFixed(2),
				pnlPct: +(((gross - feeIn - feeOut) / (q * lot.price)) * 100).toFixed(2),
			});
			lot.qty -= q;
			lot.fee -= feeIn;
			left -= q;
			// The exchange takes its fee out of the coin, so a sell is always a
			// hair smaller than the buy it closes. Left alone, that crumb gets
			// matched against a later sell and invents a trade with no size and a
			// months-long hold. Anything under 2% of the lot is a rounding artefact.
			if (lot.qty <= lot.openQty * 0.02) lots.shift();
		}
	}
	const open = [];
	for (const [sym, lots] of openLots)
		for (const lot of lots)
			if (lot.qty > lot.openQty * 0.02)
				open.push({
					sym,
					opened: lot.ts.slice(0, 10),
					entry: lot.price,
					qty: +lot.qty.toPrecision(8),
					size: +(lot.qty * lot.price).toFixed(2),
					stop: null,
				});
	return { closed, open };
}

/** Peak-to-trough on the cumulative P&L curve, in currency and in percent. */
function drawdown(curve) {
	let peak = 0, worst = 0, worstPct = 0;
	for (const p of curve) {
		peak = Math.max(peak, p.cum);
		const dd = p.cum - peak;
		if (dd < worst) {
			worst = dd;
			worstPct = peak > 0 ? (dd / peak) * 100 : 0;
		}
	}
	return { abs: +worst.toFixed(2), pct: +worstPct.toFixed(1) };
}

const dir = process.argv[2];
const write = process.argv.includes('--write');
if (!dir) {
	console.error('usage: node scripts/import-trades.mjs <export-dir> [--write]');
	process.exit(1);
}

const fills = load(dir);
const { closed, open } = pair(fills);
closed.sort((a, b) => a.closed.localeCompare(b.closed));

let cum = 0;
const curve = closed.map((t) => {
	cum += t.pnl;
	return { date: t.closed, sym: t.sym, pnl: t.pnl, cum: +cum.toFixed(2) };
});

const wins = closed.filter((t) => t.pnl > 0);
const losses = closed.filter((t) => t.pnl <= 0);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);
const avg = (xs) => (xs.length ? sum(xs) / xs.length : null);
const grossWin = sum(wins.map((t) => t.pnl));
const grossLoss = Math.abs(sum(losses.map((t) => t.pnl)));

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const out = {
	_comment: 'Generated by scripts/import-trades.mjs from an exchange export. Do not hand-edit the trades.',
	verified: true,
	source: 'OKX spot · order history export',
	since: closed[0]?.opened ?? null,
	through: closed.at(-1)?.closed ?? null,
	rules: prev.rules ?? FALLBACK_RULES,
	stats: {
		trades: closed.length,
		wins: wins.length,
		losses: losses.length,
		winRate: closed.length ? +((wins.length / closed.length) * 100).toFixed(1) : null,
		netPnl: +sum(closed.map((t) => t.pnl)).toFixed(2),
		fees: +sum(closed.map((t) => t.fees)).toFixed(2),
		avgWin: avg(wins.map((t) => t.pnlPct)) != null ? +avg(wins.map((t) => t.pnlPct)).toFixed(2) : null,
		avgLoss: avg(losses.map((t) => t.pnlPct)) != null ? +avg(losses.map((t) => t.pnlPct)).toFixed(2) : null,
		// how many dollars won per dollar lost — the number that decides whether a
		// sub-50% win rate is still a system worth running
		profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : null,
		avgHeld: avg(closed.map((t) => t.held)) != null ? +avg(closed.map((t) => t.held)).toFixed(1) : null,
		best: closed.length ? Math.max(...closed.map((t) => t.pnlPct)) : null,
		worst: closed.length ? Math.min(...closed.map((t) => t.pnlPct)) : null,
		avgSize: avg(closed.map((t) => t.size)) != null ? +avg(closed.map((t) => t.size)).toFixed(0) : null,
		drawdown: drawdown(curve),
	},
	curve,
	open,
	closed,
};

const json = JSON.stringify(out, null, '\t') + '\n';
if (write) {
	writeFileSync(OUT, json);
	console.log(`[trades] wrote ${OUT}`);
} else {
	console.log(json);
}
console.log(
	`[trades] ${closed.length} closed · ${wins.length}W/${losses.length}L · ` +
		`net ${out.stats.netPnl} USDT · PF ${out.stats.profitFactor} · ` +
		`maxDD ${out.stats.drawdown.abs} (${out.stats.drawdown.pct}%) · ${open.length} open`,
);
