import { buildMetrics } from '../_lib/metrics.js';

export async function onRequest() {
	const data = await buildMetrics();
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=30',
			'access-control-allow-origin': '*',
		},
	});
}
