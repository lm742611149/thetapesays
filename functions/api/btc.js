import { fullDaily, btcAnalytics, monthlyMatrix } from '../_lib/btc-analytics.js';

/** Recomputed per request (edge-cached), so the page is never showing build-time numbers. */
export async function onRequest() {
	try {
		const daily = await fullDaily();
		const body = JSON.stringify({
			ts: Date.now(),
			price: daily.at(-1).c,
			monthly: monthlyMatrix(daily),
			...btcAnalytics(daily),
		});
		return new Response(body, {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=30',
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
