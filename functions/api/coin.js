import { fullDaily, coinAnalytics, btcAnalytics, chainTvl, CHAIN_SLUG } from '../_lib/btc-analytics.js';

/** Per-coin analytics, recomputed at the edge so nothing is frozen at build time. */
export async function onRequest({ request }) {
	const sym = (new URL(request.url).searchParams.get('sym') || 'BTC').toUpperCase();
	if (!/^[A-Z]{2,6}$/.test(sym)) return new Response('bad symbol', { status: 400 });

	try {
		const [daily, btcDaily] = await Promise.all([
			fullDaily(`${sym}USDT`),
			sym === 'BTC' ? Promise.resolve(null) : fullDaily('BTCUSDT'),
		]);
		const out = {
			ts: Date.now(),
			sym,
			price: daily.at(-1).c,
			...coinAnalytics(daily, btcDaily),
		};
		if (sym === 'BTC') Object.assign(out, btcAnalytics(daily));
		const slug = CHAIN_SLUG[sym];
		if (slug) out.tvl = await chainTvl(slug);

		return new Response(JSON.stringify(out), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=300, s-maxage=300',
				'access-control-allow-origin': '*',
			},
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
			status: 502,
			headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
		});
	}
}
