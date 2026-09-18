/**
 * The "ahead" rail on the event log.
 *
 * This used to be three objects hand-written into events.json with the timing
 * spelled out in prose — "This Friday", "November 2026". Prose does not expire.
 * The Friday passes and the line still says This Friday, which is worse than
 * showing nothing: the one claim this site makes is that its numbers are
 * checkable, and a stale date is an unchecked number sitting on the front page.
 *
 * So nothing here carries a written-out date. An entry carries the instant it
 * happens; how far away that is gets derived at render time. Three of them are
 * not even stored — the halving, the next difficulty retarget and the quarterly
 * options expiry are all functions of chain state or of a published rule, so
 * they are computed from the tape rather than typed in and left to rot.
 *
 * Both the snapshot and the browser import this file, so the relative wording
 * agrees on both sides and a stale snapshot self-corrects on load.
 */

const DAY = 86400000;

const utcMidnight = (t) => {
	const d = new Date(t);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * How far out something is, in the words a reader would use.
 *
 * Precision matters more than it looks. An entry known only to the month must
 * never render as a day — "in 47 days" off a date that was itself a guess is
 * false precision, and the halving is the same story a year out, where ten
 * minutes a block has drifted into weeks of error.
 */
export function relativeWhen(at, now = Date.now(), precision = 'day') {
	const days = Math.round((utcMidnight(at) - utcMidnight(now)) / DAY);
	const d = new Date(at);
	const month = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
	const monthShort = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

	if (days < 0) return null;
	if (precision === 'month' || days > 300) return `${month} ${d.getUTCFullYear()}`;
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	if (days < 7) return `This ${d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}`;
	if (days < 21) return `in ${days} days`;
	return monthShort;
}

/** Sort key that keeps month-precision entries from claiming a day slot. */
const at = (e) => new Date(e.at).getTime();

/**
 * The quarterly options expiry — the one scheduled flow event in crypto that
 * needs no source. Deribit settles on the last Friday of the quarter at 08:00
 * UTC, and the quarterlies are where the open interest concentrates.
 */
export function quarterlyExpiry(now = Date.now()) {
	const d = new Date(now);
	for (let q = 0; q < 5; q++) {
		const year = d.getUTCFullYear() + Math.floor((Math.floor(d.getUTCMonth() / 3) * 3 + q * 3) / 12);
		const month = ((Math.floor(d.getUTCMonth() / 3) * 3 + q * 3) % 12) + 3;
		// last day of the quarter's final month, walked back to Friday
		const last = new Date(Date.UTC(year, month, 0, 8));
		last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() + 2) % 7));
		if (last.getTime() > now) return last.getTime();
	}
	return null;
}

/**
 * Build the rail: the derived entries, plus whatever is still ahead in the
 * hand-kept calendar, nearest first.
 *
 * `chain` is the onchain block from the snapshot. Without it the two chain
 * entries are simply absent — an empty rail beats a guessed block height.
 */
export function buildUpcoming({ entries = [], chain, now = Date.now(), limit = 5 } = {}) {
	const out = [];

	if (chain?.halvingAt) {
		out.push({
			at: new Date(chain.halvingAt).toISOString(),
			precision: 'month',
			what: `Fourth halving, block ${chain.halvingHeight.toLocaleString('en-US')}`,
			why:
				`Subsidy drops to ${50 / 2 ** (chain.halvingHeight / 210000)} BTC. ` +
				`${chain.blocksToHalving.toLocaleString('en-US')} blocks out, dated off ten minutes a ` +
				`block — the real date moves with hashrate.`,
			derived: 'halving',
		});
	}

	if (chain?.retargetAt) {
		// Blockchair hands this back as "YYYY-MM-DD HH:MM:SS", UTC, no zone marker
		const ts = Date.parse(String(chain.retargetAt).replace(' ', 'T') + 'Z');
		if (Number.isFinite(ts) && ts > now) {
			const pct = chain.retargetPct;
			out.push({
				at: new Date(ts).toISOString(),
				precision: 'day',
				what: 'Difficulty retarget',
				why:
					pct == null
						? 'Every 2,016 blocks the network reprices the cost of a block.'
						: `Estimated ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%, which moves every miner's ` +
							`shutdown price by the same amount in the opposite direction.`,
				derived: 'retarget',
			});
		}
	}

	const expiry = quarterlyExpiry(now);
	if (expiry) {
		out.push({
			at: new Date(expiry).toISOString(),
			precision: 'day',
			what: 'Quarterly options expiry',
			why: 'Deribit settles the quarterlies 08:00 UTC on the last Friday. This is where the open interest sits, so it is the one date that reliably concentrates flow.',
			derived: 'expiry',
		});
	}

	for (const e of entries) {
		if (!e?.at || !e?.what) continue;
		const ts = Date.parse(e.at);
		if (!Number.isFinite(ts)) continue;
		// a month-precision entry is still ahead until the month itself is gone
		const gone = e.precision === 'month'
			? new Date(ts).getUTCMonth() !== new Date(now).getUTCMonth() && ts < now
			: utcMidnight(ts) < utcMidnight(now);
		if (gone) continue;
		out.push({ ...e, at: new Date(ts).toISOString() });
	}

	return out
		.sort((a, b) => at(a) - at(b))
		.slice(0, limit)
		.map((e) => ({ ...e, when: relativeWhen(e.at, now, e.precision) }))
		.filter((e) => e.when);
}
