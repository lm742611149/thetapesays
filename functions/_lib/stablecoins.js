/**
 * Stablecoin supply: who holds it now, and how it got there.
 *
 * DefiLlama publishes this through two endpoints that do not quite agree. The
 * per-chain snapshot sums to $304B; the all-chains history reports $309B for
 * the same day. The gap is a boundary question — bridged supply counted at the
 * destination, chains too small to list — not an error in either. So the two
 * are never mixed: the ring and its percentages come from the chain endpoint,
 * the lines come from the history endpoint, and the panel says which is which.
 * Dividing one by the other to save a request would invent a number that no
 * source published.
 *
 * Shares are therefore computed inside the history series, chain over the same
 * series' total, which is self-consistent even where it differs by a few tenths
 * from the ring beside it.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = {
	headers: { 'user-agent': UA, accept: 'application/json' },
	cf: { cacheTtl: 30, cacheEverything: true },
};

const BASE = 'https://stablecoins.llama.fi';
export const CHAINS_URL = `${BASE}/stablecoinchains`;
export const CHART_URL = (chain) => `${BASE}/stablecoincharts/${chain ? encodeURIComponent(chain) : 'all'}`;

const J = async (url) => {
	const r = await fetch(url, opts);
	if (!r.ok) throw new Error(`${url} -> ${r.status}`);
	return r.json();
};

/** USD-pegged circulating supply. The other pegs are rounding at this scale. */
const usd = (row) => row?.totalCirculatingUSD?.peggedUSD ?? 0;

/**
 * Weekly, two years back. A daily series over eight years is 3,200 points to
 * draw a line that moves in months — the file it would add to every page load
 * costs more than the detail is worth.
 */
function weekly(rows, years = 2) {
	const cutoff = Date.now() / 1000 - years * 365 * 86400;
	const out = [];
	for (const r of rows) {
		const t = +r.date;
		if (t < cutoff) continue;
		const v = usd(r);
		if (!v) continue;
		out.push({ t: t * 1000, v });
	}
	// keep every 7th, and always the last point so the line ends on today
	const step = out.filter((_, i) => i % 7 === 0);
	if (out.length && step.at(-1)?.t !== out.at(-1).t) step.push(out.at(-1));
	return step;
}

export async function stablecoins({ top = 6, lines = ['Ethereum', 'Tron'] } = {}) {
	// Sequential, not Promise.all. Each chart is a megabyte-plus of daily history
	// and firing four at once exhausts the connection pool — the same failure the
	// ETF and options builders hit, resolved the same way.
	const chainRows = await J(CHAINS_URL);
	const allRows = await J(CHART_URL());
	const chainSeries = [];
	for (const c of lines) chainSeries.push(await J(CHART_URL(c)));

	// ---- current split, from the chain endpoint ----
	const ranked = chainRows
		.map((c) => ({ name: c.name, usd: usd(c) }))
		.filter((c) => c.usd > 0)
		.sort((a, b) => b.usd - a.usd);
	const total = ranked.reduce((s, c) => s + c.usd, 0);
	const chains = ranked.slice(0, top + 6).map((c) => ({
		name: c.name,
		b: +(c.usd / 1e9).toFixed(2),
		pct: +((100 * c.usd) / total).toFixed(2),
	}));

	// ---- history, from the chart endpoint ----
	if (!lines.length) {
		// caller only wants the current split; the history endpoint is the
		// expensive half and nothing live reads it
		return {
			source: 'DefiLlama',
			asOf: new Date().toISOString().slice(0, 10),
			totalB: +(total / 1e9).toFixed(1),
			chains,
		};
	}

	const totalSeries = weekly(allRows);
	const byT = new Map(totalSeries.map((p) => [p.t, p.v]));
	const shares = lines.map((name, i) => ({
		name,
		points: weekly(chainSeries[i])
			.filter((p) => byT.has(p.t))
			.map((p) => ({ t: p.t, v: +((100 * p.v) / byT.get(p.t)).toFixed(2) })),
	}));

	const last = totalSeries.at(-1);
	return {
		source: 'DefiLlama',
		asOf: new Date(last?.t ?? Date.now()).toISOString().slice(0, 10),
		totalB: +(total / 1e9).toFixed(1),
		chains,
		history: {
			// the history endpoint's own total, which is not the ring's total
			totalB: +(last.v / 1e9).toFixed(1),
			total: totalSeries.map((p) => ({ t: p.t, v: +(p.v / 1e9).toFixed(2) })),
			shares,
		},
	};
}
