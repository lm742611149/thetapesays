/**
 * Open interest across venues for one coin.
 *
 * Every venue reports OI in its own unit — coins, contracts, or notional USD —
 * so the raw numbers are not comparable as published. Everything is normalised
 * to coins here and then valued at one common mark price, because using each
 * venue's own mark would fold a basis difference of a few dollars into a
 * comparison that is supposed to be about size.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = { headers: { 'user-agent': UA, accept: 'application/json' }, cf: { cacheTtl: 30, cacheEverything: true } };

const J = async (url, init) => {
	const r = await fetch(url, { ...opts, ...init });
	if (!r.ok) throw new Error(`${r.status}`);
	return r.json();
};

const VENUES = [
	{
		name: 'Binance',
		async load(sym) {
			const d = await J(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${sym}USDT`);
			return { coins: +d.openInterest };
		},
	},
	{
		name: 'OKX',
		async load(sym) {
			const d = (await J(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${sym}-USDT-SWAP`)).data[0];
			// oiCcy is already in coin terms; oi is in contracts
			return { coins: +d.oiCcy };
		},
	},
	{
		name: 'Bybit',
		async load(sym) {
			const d = (await J(
				`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}USDT&intervalTime=5min&limit=1`,
			)).result.list[0];
			return { coins: +d.openInterest };
		},
	},
	{
		name: 'Bitget',
		async load(sym) {
			const d = (await J(
				`https://api.bitget.com/api/v2/mix/market/open-interest?symbol=${sym}USDT&productType=usdt-futures`,
			)).data.openInterestList[0];
			return { coins: +d.size };
		},
	},
	{
		name: 'Gate',
		async load(sym) {
			// position_size counts contracts; quanto_multiplier is coins per contract
			const d = await J(`https://api.gateio.ws/api/v4/futures/usdt/contracts/${sym}_USDT`);
			return { coins: +d.position_size * (+d.quanto_multiplier || 1) };
		},
	},
	{
		name: 'Hyperliquid',
		async load(sym) {
			const d = await J('https://api.hyperliquid.xyz/info', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
			});
			const i = d[0].universe.findIndex((u) => u.name === sym);
			if (i < 0) throw new Error('not listed');
			return { coins: +d[1][i].openInterest, dayVolUsd: +d[1][i].dayNtlVlm };
		},
	},
];

/** One price for all venues, so the comparison is about size and nothing else. */
async function markPrice(sym) {
	try {
		const d = await J(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}USDT`);
		return +d.markPrice;
	} catch {
		const d = (await J(`https://www.okx.com/api/v5/market/ticker?instId=${sym}-USDT-SWAP`)).data[0];
		return +d.last;
	}
}

export async function oiAcross(sym) {
	const [price, settled] = await Promise.all([
		markPrice(sym).catch(() => null),
		Promise.allSettled(VENUES.map((v) => v.load(sym))),
	]);

	const rows = [];
	settled.forEach((res, i) => {
		if (res.status !== 'fulfilled' || !Number.isFinite(res.value.coins)) return;
		const coins = res.value.coins;
		rows.push({
			venue: VENUES[i].name,
			coins: +coins.toFixed(1),
			usdB: price ? +((coins * price) / 1e9).toFixed(3) : null,
		});
	});
	rows.sort((a, b) => b.coins - a.coins);

	const total = rows.reduce((s, r) => s + r.coins, 0);
	for (const r of rows) r.share = total > 0 ? +((r.coins / total) * 100).toFixed(1) : 0;

	return {
		sym,
		price: price ? +price.toFixed(2) : null,
		rows,
		totalCoins: +total.toFixed(1),
		totalUsdB: price ? +((total * price) / 1e9).toFixed(2) : null,
		venues: rows.length,
		asOf: Date.now(),
	};
}
