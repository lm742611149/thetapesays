import { onchain } from '../_lib/onchain.js';

export async function onRequest() {
	try {
		const data = await onchain();
		return new Response(JSON.stringify(data), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=120, s-maxage=120',
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
