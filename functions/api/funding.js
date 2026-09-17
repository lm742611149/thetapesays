const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
/**
 * Funding snapshot across the majors. Annualized from the 8-hour rate.
 * Edge-cached for a minute — funding only settles three times a day.
 */
const WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

export async function onRequest() {
	let rows = [];
	try {
		const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
			headers: { 'user-agent': UA },
			cf: { cacheTtl: 60, cacheEverything: true },
		});
		const all = await r.json();
		rows = all
			.filter((d) => WATCH.includes(d.symbol))
			.map((d) => {
				const rate = Number(d.lastFundingRate);
				return {
					sym: d.symbol.replace('USDT', ''),
					rate: rate * 100,
					apr: rate * 3 * 365 * 100,
					mark: Number(d.markPrice),
				};
			})
			.sort((a, b) => WATCH.indexOf(`${a.sym}USDT`) - WATCH.indexOf(`${b.sym}USDT`));
	} catch {
		/* fall through to empty */
	}
	return new Response(JSON.stringify({ rows, ts: Date.now() }), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=60, s-maxage=60',
			'access-control-allow-origin': '*',
		},
	});
}
