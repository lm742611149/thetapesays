/**
 * BTC cycle analytics. Everything here is derived from daily closes, so it can
 * run at the edge on each request instead of being frozen at build time.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';

const J = async (url) => {
	const r = await fetch(url, {
		headers: { 'user-agent': UA, accept: 'application/json' },
		cf: { cacheTtl: 180, cacheEverything: true },
	});
	if (!r.ok) throw new Error(`${url} -> ${r.status}`);
	return r.json();
};

/** Every daily bar since listing, paged 1000 at a time. */
export async function fullDaily(symbol = 'BTCUSDT', fromISO = '2017-08-01') {
	let start = Date.parse(fromISO);
	const rows = [];
	for (let page = 0; page < 6; page++) {
		const b = await J(
			`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&limit=1000`,
		);
		if (!b.length) break;
		rows.push(...b);
		if (b.length < 1000) break;
		start = b[b.length - 1][0] + 1;
	}
	return rows.map((r) => ({ t: r[0], o: +r[1], c: +r[4] }));
}

export function monthlyMatrix(daily) {
	const by = new Map();
	for (const d of daily) {
		const dt = new Date(d.t);
		const k = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
		if (!by.has(k)) by.set(k, { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), o: d.c, c: d.c });
		by.get(k).c = d.c;
	}
	return [...by.values()].map((v) => ({ y: v.y, m: v.m, r: +((v.c / v.o - 1) * 100).toFixed(1) }));
}

/** BTC-only cycle analytics, all derived from the daily closes. */
export function btcAnalytics(daily) {
	const px = daily.map((d) => d.c);
	const n = px.length;
	const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
	const sd = (a) => {
		const m = mean(a);
		return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
	};
	const quant = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

	// --- Mayer Multiple (price / 200d mean) + its historical distribution ---
	const mayerSeries = [];
	for (let i = 199; i < n; i++) {
		const m = mean(px.slice(i - 199, i + 1));
		mayerSeries.push({ t: daily[i].t, v: +(px[i] / m).toFixed(3) });
	}
	const mvals = mayerSeries.map((x) => x.v).sort((a, b) => a - b);
	const nowMayer = mayerSeries.at(-1).v;
	const BUCKETS = 24, MHI = 2.6;
	const hist = Array.from({ length: BUCKETS }, () => 0);
	for (const v of mvals) hist[Math.min(BUCKETS - 1, Math.floor((v / MHI) * BUCKETS))]++;
	const mayer = {
		now: nowMayer,
		pctile: +((mvals.filter((x) => x <= nowMayer).length / mvals.length) * 100).toFixed(0),
		median: +quant(mvals, 0.5).toFixed(3),
		hist,
		histMax: MHI,
		series: mayerSeries.filter((_, i) => i % 5 === 0 || i === mayerSeries.length - 1),
	};

	// --- drawdown from the running high ---
	let peak = 0;
	const ddAll = daily.map((d) => {
		peak = Math.max(peak, d.c);
		return { t: d.t, v: +((d.c / peak - 1) * 100).toFixed(1) };
	});
	const drawdown = {
		now: ddAll.at(-1).v,
		worst: Math.min(...ddAll.map((x) => x.v)),
		series: ddAll.filter((_, i) => i % 4 === 0 || i === ddAll.length - 1),
	};

	// --- halving cycles, each indexed to 100 at its halving ---
	const HALVINGS = [
		{ date: '2016-07-09', n: 2 },
		{ date: '2020-05-11', n: 3 },
		{ date: '2024-04-20', n: 4 },
	];
	const cycles = HALVINGS.map(({ date, n: num }) => {
		const t0 = Date.parse(date);
		const seg = daily.filter((d) => d.t >= t0);
		const base = seg[0]?.c;
		return {
			n: num,
			date,
			base: base ? Math.round(base) : null,
			partial: Date.parse(daily[0].t) > t0,
			points: seg
				.map((d) => ({ d: Math.round((d.t - t0) / 86400000), v: +((d.c / base) * 100).toFixed(1) }))
				.filter((_, i) => i % 5 === 0 || i === seg.length - 1),
		};
	}).filter((c) => c.points.length > 10);

	// --- volatility cone ---
	const lr = [];
	for (let i = 1; i < n; i++) lr.push(Math.log(px[i] / px[i - 1]));
	const cone = [7, 30, 90, 180, 365].map((w) => {
		const out = [];
		for (let i = w; i <= lr.length; i++) out.push(sd(lr.slice(i - w, i)) * Math.sqrt(365) * 100);
		const srt = [...out].sort((a, b) => a - b);
		return {
			w,
			now: +out.at(-1).toFixed(1),
			min: +srt[0].toFixed(0),
			p25: +quant(srt, 0.25).toFixed(0),
			med: +quant(srt, 0.5).toFixed(0),
			p75: +quant(srt, 0.75).toFixed(0),
			max: +srt.at(-1).toFixed(0),
		};
	});

	// --- day-of-week ---
	const buckets = Array.from({ length: 7 }, () => []);
	for (let i = 1; i < n; i++) buckets[new Date(daily[i].t).getUTCDay()].push(px[i] / px[i - 1] - 1);
	const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dow = buckets.map((a, i) => ({
		day: NAMES[i],
		avg: +(mean(a) * 100).toFixed(3),
		win: +((a.filter((x) => x > 0).length / a.length) * 100).toFixed(0),
		n: a.length,
	}));

	// --- Puell Multiple (issuance value vs its own 365d mean) ---
	const subsidy = (t) =>
		t < Date.parse('2020-05-11') ? 12.5 : t < Date.parse('2024-04-20') ? 6.25 : 3.125;
	const rev = daily.map((d) => subsidy(d.t) * 144 * d.c);
	const pSeries = [];
	for (let i = 365; i < n; i++) {
		pSeries.push({ t: daily[i].t, v: +(rev[i] / mean(rev.slice(i - 365, i))).toFixed(3) });
	}
	const pvals = pSeries.map((x) => x.v);
	const puell = {
		now: pSeries.at(-1).v,
		min: +Math.min(...pvals).toFixed(2),
		max: +Math.max(...pvals).toFixed(2),
		series: pSeries.filter((_, i) => i % 5 === 0 || i === pSeries.length - 1),
	};

	return { mayer, drawdown, cycles, cone, dow, puell, firstBar: daily[0].t };
}

/** DefiLlama chain slugs for the coins that have their own page. */
export const CHAIN_SLUG = { ETH: 'Ethereum', SOL: 'Solana', BNB: 'BSC', BTC: 'Bitcoin' };

/** Analytics that apply to any coin, derived from its own daily closes. */
export function coinAnalytics(daily, btcDaily) {
	const px = daily.map((d) => d.c);
	const n = px.length;
	const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
	const sd = (a) => {
		const m = mean(a);
		return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
	};
	const quant = (srt, q) => srt[Math.min(srt.length - 1, Math.floor(srt.length * q))];

	let peak = 0;
	const ddAll = daily.map((d) => {
		peak = Math.max(peak, d.c);
		return { t: d.t, v: +((d.c / peak - 1) * 100).toFixed(1) };
	});
	const drawdown = {
		now: ddAll.at(-1).v,
		worst: Math.min(...ddAll.map((x) => x.v)),
		series: ddAll.filter((_, i) => i % 4 === 0 || i === ddAll.length - 1),
	};

	const lr = [];
	for (let i = 1; i < n; i++) lr.push(Math.log(px[i] / px[i - 1]));
	const cone = [7, 30, 90, 180, 365]
		.filter((w) => lr.length > w + 30)
		.map((w) => {
			const out = [];
			for (let i = w; i <= lr.length; i++) out.push(sd(lr.slice(i - w, i)) * Math.sqrt(365) * 100);
			const srt = [...out].sort((a, b) => a - b);
			return {
				w,
				now: +out.at(-1).toFixed(1),
				min: +srt[0].toFixed(0),
				p25: +quant(srt, 0.25).toFixed(0),
				med: +quant(srt, 0.5).toFixed(0),
				p75: +quant(srt, 0.75).toFixed(0),
				max: +srt.at(-1).toFixed(0),
			};
		});

	const buckets = Array.from({ length: 7 }, () => []);
	for (let i = 1; i < n; i++) buckets[new Date(daily[i].t).getUTCDay()].push(px[i] / px[i - 1] - 1);
	const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dow = buckets.map((a, i) => ({
		day: NAMES[i],
		avg: a.length ? +(mean(a) * 100).toFixed(3) : 0,
		win: a.length ? +((a.filter((x) => x > 0).length / a.length) * 100).toFixed(0) : 0,
		n: a.length,
	}));

	// --- ratio against BTC: the number that actually matters for an altcoin ---
	let ratio = null;
	if (btcDaily?.length) {
		const byDay = new Map(btcDaily.map((d) => [d.t, d.c]));
		const pts = [];
		for (const d of daily) {
			const b = byDay.get(d.t);
			if (b) pts.push({ t: d.t, v: d.c / b });
		}
		if (pts.length > 40) {
			const vals = pts.map((x) => x.v);
			const srt = [...vals].sort((a, b) => a - b);
			const cur = vals.at(-1);
			const ago = (k) => (vals.length > k ? +((cur / vals.at(-1 - k) - 1) * 100).toFixed(1) : null);
			ratio = {
				now: cur,
				pctile: +((srt.filter((x) => x <= cur).length / srt.length) * 100).toFixed(0),
				high: srt.at(-1),
				low: srt[0],
				chg: { d30: ago(30), d90: ago(90), d365: ago(365) },
				series: pts
					.map((x) => ({ t: x.t, v: +x.v.toPrecision(6) }))
					.filter((_, i) => i % 4 === 0 || i === pts.length - 1),
			};
		}
	}

	return { drawdown, cone, dow, ratio, monthly: monthlyMatrix(daily), firstBar: daily[0].t };
}

/** Chain TVL history from DefiLlama (no key required). */
export async function chainTvl(slug) {
	try {
		const rows = await J(`https://api.llama.fi/v2/historicalChainTvl/${slug}`);
		const pts = rows
			.map((r) => ({ t: r.date * 1000, v: +(r.tvl / 1e9).toFixed(3) }))
			.filter((x) => x.v > 0);
		const recent = pts.slice(-730);
		const vals = recent.map((x) => x.v);
		return {
			now: vals.at(-1),
			peak: Math.max(...pts.map((x) => x.v)),
			chg30: vals.length > 30 ? +((vals.at(-1) / vals.at(-31) - 1) * 100).toFixed(1) : null,
			chg365: vals.length > 365 ? +((vals.at(-1) / vals.at(-366) - 1) * 100).toFixed(1) : null,
			series: recent.filter((_, i) => i % 3 === 0 || i === recent.length - 1),
		};
	} catch {
		return null;
	}
}
