/**
 * What changed since yesterday.
 *
 * The site was all levels and no differences: a reader saw what AHR999 is, not
 * that it moved. A level answers "where are we", which you only need to ask
 * once; a difference answers "what happened", which is the reason to come back
 * tomorrow.
 *
 * Most of these have no history series behind them — the chain stats, the
 * stablecoin split and the sentiment index are each a single current reading
 * from upstream — so the snapshot keeps its own rolling record and the delta is
 * measured against it. A metric with no baseline yet shows its level and no
 * delta. Printing a zero for "we have not been running long enough" would be a
 * made-up number, which is the one thing this page cannot do.
 */

/** ~6h cadence, 30 days. Small enough to ship, long enough for a 30d sigma. */
export const KEEP_MS = 30 * 86400000;

/**
 * The tracked set. `fmt` is how the level reads, `dp` how many decimals the
 * delta carries, and `bigger` says which direction counts as hotter — used for
 * colour, not for judgement.
 */
/*
 * BTC price is recorded but not listed: the stat row above this panel already
 * carries its 24h change, and that one is driven by the live socket. Printing a
 * build-time copy beside it would show two different numbers for one thing.
 */
/**
 * `scale` puts the level on a track, which a bare figure cannot do: 1.19x means
 * nothing until you know the thing runs 0 to 3 and turns expensive above 2.
 *
 * Every range here is either the metric's definition (sentiment is 0-100,
 * drawdown cannot pass -100%) or the banding the gauges on this page already
 * use. None of them is a range invented to make a bar look full. A metric with
 * no published range gets `scale: null` and shows no track until the rolling
 * record can supply its own min and max — which is why three of these are bare
 * on the first day.
 */
export const TRACKED = [
	{ key: 'ahr999',    label: 'AHR999',         fmt: 'n3',   dp: 1, bigger: 'up', live: 'price',
	  scale: { min: 0, max: 3, marks: [0.45, 1.2], note: 'under 0.45 is the accumulation band' } },
	{ key: 'mayer', live: 'price',     label: 'Mayer',          fmt: 'n3',   dp: 1, bigger: 'up',
	  scale: { min: 0, max: 3, marks: [1, 2.4], note: '1.0 is the 200-day average; 2.4 has marked tops' } },
	{ key: 'ma200w', live: 'price',    label: '200W mult',      fmt: 'x2',   dp: 1, bigger: 'up',
	  scale: { min: 0, max: 3, marks: [1, 2], note: 'under 1 has only happened in deep bears' } },
	{ key: 'ath', live: 'price',       label: 'From ATH',       fmt: 'pct1', dp: 1, bigger: 'up',
	  scale: { min: -100, max: 0, marks: [-50], note: 'drawdown from the all-time high' } },
	{ key: 'fng', live: 'fetch',       label: 'Fear & greed',   fmt: 'n0',   dp: 0, bigger: 'up',
	  scale: { min: 0, max: 100, marks: [25, 75], note: 'index definition, 0 to 100' } },
	{ key: 'dominance', live: 'fetch', label: 'BTC dominance',  fmt: 'pct2', dp: 1, bigger: 'up', scale: null },
	{ key: 'hashrate', live: 'fetch',  label: 'Hashrate',       fmt: 'eh',   dp: 1, bigger: 'up', scale: null },
	{ key: 'stableB', live: 'fetch',   label: 'Stablecoins',    fmt: 'usdB', dp: 1, bigger: 'up', scale: null },
];

/**
 * The denominators behind the price-derived metrics.
 *
 * Mayer is price over a 200-day average, the 200-week multiple is price over a
 * 200-week average, drawdown is price over the all-time high, and AHR999 is
 * price over a 200-day cost basis times price over an age-fitted value. Each of
 * those divisors moves by a fraction of a percent per day; the price moves all
 * the time. So the browser gets the divisors and does the division, rather than
 * the page waiting six hours for a number whose fast half it already has.
 */
export function readDenoms(data) {
	const n = (v) => (Number.isFinite(v) ? +v : undefined);
	return {
		ma200d: n(data?.ma200d),
		ma200w: n(data?.ma200w),
		athPrice: n(data?.ath?.price),
		ahrDca: n(data?.ahr999?.dca),
		ahrGrowth: n(data?.ahr999?.growth),
	};
}

/** Pull the tracked numbers out of a snapshot document. */
export function readPoint(data, stable) {
	const n = (v) => (Number.isFinite(v) ? +v : undefined);
	return {
		t: Date.now(),
		price: n(data.price),
		ahr999: n(data.ahr999?.value),
		mayer: n(data.btc?.mayer?.now),
		ma200w: n(data.ma200wMult),
		ath: n(data.ath?.drawdown),
		fng: n(data.fng?.value),
		dominance: n(data.dominance ?? data.onchain?.chain?.dominance),
		hashrate: n(data.onchain?.chain?.hashrateEh),
		stableB: n(stable?.totalB),
	};
}

/** Append, drop anything past the window, and keep it sorted. */
export function appendHistory(prev, point) {
	const rows = [...(prev ?? []), point]
		.filter((r) => Number.isFinite(r?.t) && point.t - r.t <= KEEP_MS)
		.sort((a, b) => a.t - b.t);
	return rows;
}

/**
 * Baselines the upstream already carries, for the metrics that have one.
 *
 * Three of these do not need the rolling record at all: the quote endpoint
 * reports a 24h change, the sentiment index publishes yesterday's reading
 * beside today's, and Mayer is computed off a daily series. Using them means
 * the panel says something real on day one instead of waiting a day to fill
 * in, and they stay authoritative afterwards — a value from the source beats
 * one reconstructed from when a cron happened to run.
 */
export function readPriors(data) {
	const out = {};
	const d1 = data?.chg?.d1;
	if (Number.isFinite(d1) && Number.isFinite(data?.price) && d1 !== -100) {
		out.price = data.price / (1 + d1 / 100);
	}
	if (Number.isFinite(data?.fng?.prev)) out.fng = data.fng.prev;
	const ms = data?.btc?.mayer?.series;
	if (Array.isArray(ms) && ms.length >= 2 && Number.isFinite(ms.at(-2)?.v)) out.mayer = ms.at(-2).v;
	return out;
}

/**
 * The row nearest to `agoMs` before now, but only if it is actually close to
 * it. After an outage the nearest row could be four days old, and labelling
 * that "24h" would be a lie told by arithmetic.
 */
function baselineAt(rows, now, agoMs, toleranceMs) {
	const target = now - agoMs;
	let best, bd = Infinity;
	for (const r of rows) {
		const d = Math.abs(r.t - target);
		if (d < bd) { bd = d; best = r; }
	}
	return bd <= toleranceMs ? best : undefined;
}

/**
 * 24h change per tracked metric, plus how unusual that change is against the
 * last 30 days of daily moves. Two sigma is flagged; the point of the flag is
 * to say "this one is worth your attention today", which a raw percentage
 * cannot do across metrics on different scales.
 */
export function buildMoved(rows, current, { now = Date.now(), priors = {}, scales = {} } = {}) {
	const base = baselineAt(rows, now, 86400000, 8 * 3600000);
	const out = [];

	for (const m of TRACKED) {
		const v = current?.[m.key];
		if (!Number.isFinite(v)) continue;
		// the source's own yesterday wins; the rolling record is the fallback
		const b = priors[m.key] ?? base?.[m.key];
		let delta, pct, sigma;

		if (Number.isFinite(b) && b !== 0) {
			delta = v - b;
			pct = (delta / Math.abs(b)) * 100;

			// distribution of daily moves in the window, for the flag
			const daily = [];
			for (const r of rows) {
				const earlier = baselineAt(rows, r.t, 86400000, 8 * 3600000);
				const a = earlier?.[m.key], c = r?.[m.key];
				if (Number.isFinite(a) && Number.isFinite(c) && a !== 0) daily.push(((c - a) / Math.abs(a)) * 100);
			}
			if (daily.length >= 7) {
				const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
				const sd = Math.sqrt(daily.reduce((s, x) => s + (x - mean) ** 2, 0) / daily.length);
				if (sd > 0) sigma = Math.abs(pct - mean) / sd;
			}
		}
		// where the level sits on its track, 0..1 — from the published range, or
		// from the record's own span once there is one worth calling a range
		let scale = m.scale;
		if (!scale && scales?.[m.key]) scale = scales[m.key];
		let pos;
		if (scale && scale.max > scale.min) {
			pos = Math.min(1, Math.max(0, (v - scale.min) / (scale.max - scale.min)));
		}

		out.push({ ...m, scale: scale ?? null, pos, value: v, base: Number.isFinite(b) ? b : null, delta, pct, sigma, notable: (sigma ?? 0) >= 2 });
	}
	return { asOf: now, since: base?.t, rows: out };
}
