import { oiAcross } from '../_lib/oi.js';

export async function onRequest({ request }) {
	const sym = (new URL(request.url).searchParams.get('sym') || 'BTC').toUpperCase();
	if (!/^[A-Z]{2,6}$/.test(sym)) return new Response('bad symbol', { status: 400 });
	const data = await oiAcross(sym);
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=20, s-maxage=20',
			'access-control-allow-origin': '*',
		},
	});
}
