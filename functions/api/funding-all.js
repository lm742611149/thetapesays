import { fundingAcross } from '../_lib/funding.js';

export async function onRequest({ request }) {
	const sym = (new URL(request.url).searchParams.get('sym') || 'BTC').toUpperCase();
	if (!/^[A-Z]{2,6}$/.test(sym)) return new Response('bad symbol', { status: 400 });
	const data = await fundingAcross(sym);
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=30',
			'access-control-allow-origin': '*',
		},
	});
}
