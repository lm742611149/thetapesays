/**
 * Funding across venues for one coin. Two things make a naive comparison wrong,
 * so both are normalised here:
 *   - settlement interval differs (Hyperliquid pays hourly, the rest 8-hourly),
 *     so only the annualised figure is comparable;
 *   - each venue reports its own next-settlement timestamp, and OKX reports the
 *     *current* period in fundingTime with nextFundingTime one cycle further out.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = { headers: { 'user-agent': UA, accept: 'application/json' }, cf: { cacheTtl: 30, cacheEverything: true } };

const J = async (url, init) => {
	const r = await fetch(url, { ...opts, ...init });
	if (!r.ok) throw new Error(`${r.status}`);
	return r.json();
};

/** hours -> payments per year */
const perYear = (h) => (24 / h) * 365;

const VENUES = [
	{
		name: 'Binance',
		hours: 8,
		async load(sym) {
			const d = await J(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}USDT`);
			return { rate: +d.lastFundingRate, next: +d.nextFundingTime, mark: +d.markPrice };
		},
	},
	{
		name: 'OKX',
		hours: 8,
		async load(sym) {
			const d = (await J(`https://www.okx.com/api/v5/public/funding-rate?instId=${sym}-USDT-SWAP`)).data[0];
			// fundingTime is this period's settlement; nextFundingTime is the one after
			return { rate: +d.fundingRate, next: +d.fundingTime };
		},
	},
	{
		name: 'Bybit',
		hours: 8,
		async load(sym) {
			const d = (await J(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${sym}USDT`))
				.result.list[0];
			return { rate: +d.fundingRate, next: +d.nextFundingTime, mark: +d.markPrice };
		},
	},
	{
		name: 'Bitget',
		hours: 8,
		async load(sym) {
			const d = (await J(
				`https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=${sym}USDT&productType=usdt-futures`,
			)).data[0];
			return { rate: +d.fundingRate, next: +d.nextUpdate, hours: +(d.fundingRateInterval || 8) };
		},
	},
	{
		name: 'Gate',
		hours: 8,
		async load(sym) {
			const d = await J(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${sym}_USDT`);
			return {
				rate: +d.funding_rate,
				next: +d.funding_next_apply * 1000,
				hours: (+d.funding_interval || 28800) / 3600,
			};
		},
	},
	{
		name: 'Hyperliquid',
		hours: 1,
		async load(sym) {
			const d = await J('https://api.hyperliquid.xyz/info', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'user-agent': UA },
				body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
			});
			const i = d[0].universe.findIndex((u) => u.name === sym);
			if (i < 0) throw new Error('not listed');
			// hourly settlement, on the hour
			const next = Math.ceil(Date.now() / 3600000) * 3600000;
			return { rate: +d[1][i].funding, next, mark: +d[1][i].markPx };
		},
	},
];

export async function fundingAcross(sym = 'BTC') {
	const settled = await Promise.allSettled(VENUES.map((v) => v.load(sym)));
	const rows = [];
	const errors = [];
	settled.forEach((res, i) => {
		const v = VENUES[i];
		if (res.status !== 'fulfilled') {
			errors.push(`${v.name}: ${res.reason?.message ?? 'failed'}`);
			return;
		}
		const hours = res.value.hours ?? v.hours;
		rows.push({
			venue: v.name,
			hours,
			rate: res.value.rate * 100,
			apr: res.value.rate * perYear(hours) * 100,
			next: res.value.next,
			mark: res.value.mark ?? null,
		});
	});
	rows.sort((a, b) => b.apr - a.apr);

	// the spread is the whole point for anyone running a carry book
	const spread = rows.length > 1
		? { top: rows[0], bottom: rows[rows.length - 1], apr: rows[0].apr - rows[rows.length - 1].apr }
		: null;

	return { sym, ts: Date.now(), rows, spread, errors };
}
