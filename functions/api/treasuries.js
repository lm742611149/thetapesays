import { treasuries, COINS } from '../_lib/treasuries.js';

export async function onRequest({ request }) {
	const coin = (new URL(request.url).searchParams.get('coin') || 'BTC').toUpperCase();
	if (!COINS[coin]) return new Response('bad coin', { status: 400 });
	try {
		const data = await treasuries(coin);
		return new Response(JSON.stringify(data), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				// filings move quarterly; the upstream is rate-limited, so cache hard
				'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=30',
				'access-control-allow-origin': '*',
			},
		});
	} catch (e) {
		return new Response(JSON.stringify({ error: String(e) }), {
			status: 502,
			headers: { 'content-type': 'application/json; charset=utf-8' },
		});
	}
}
