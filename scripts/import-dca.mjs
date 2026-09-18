/**
 * One-off import: exchange order export -> de-identified fill list.
 *
 * Run when there are new buys to add. The CSV stays out of the repo (it carries
 * order ids); what ships is the fill list, which is exactly what a reader would
 * need to check any number on /dca and nothing more.
 *
 *   node scripts/import-dca.mjs <binance-order-export.csv>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node scripts/import-dca.mjs <export.csv>'); process.exit(1); }
const OUT = 'src/data/dca-fills.json';
const num = (s) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0;

/**
 * Read by position, not by header name: the export has two columns both called
 * 时间, so a keyed read silently keeps the second and, mixing Filled with
 * FILLED, a case-sensitive status check drops 98% of the rows.
 */
const parsed = readFileSync(SRC, 'utf8').replace(/^﻿/, '').trim().split('\n').slice(1)
	.map((line) => line.split(','))
	.filter((c) => c.length >= 12 && c[11].trim().toLowerCase() === 'filled' && c[4].trim().toUpperCase() === 'BUY')
	.map((c) => ({
		t: Date.parse(c[0].slice(0, 19).replace(' ', 'T') + 'Z'),
		sym: c[2].replace(/USDT$/, ''),
		qty: num(c[8]),
		px: num(c[9]),
		usdt: num(c[10]),
	}))
	.filter((f) => Number.isFinite(f.t) && f.qty > 0 && f.usdt > 0);

// merge with whatever is already recorded, de-duplicated on the fill itself
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).fills ?? [] : [];
const key = (f) => `${f.t}|${f.sym}|${f.qty}|${f.usdt}`;
const seen = new Map(prev.map((f) => [key(f), f]));
let added = 0;
for (const f of parsed) if (!seen.has(key(f))) { seen.set(key(f), f); added++; }
const fills = [...seen.values()].sort((a, b) => a.t - b.t);

writeFileSync(OUT, JSON.stringify({ updated: Date.now(), fills }, null, 0) + '\n');
console.log(
	`[dca] ${fills.length} fills (${added} new) ${new Date(fills[0].t).toISOString().slice(0, 10)}` +
		` → ${new Date(fills.at(-1).t).toISOString().slice(0, 10)} · ${(JSON.stringify(fills).length / 1024).toFixed(0)}KB`,
);
