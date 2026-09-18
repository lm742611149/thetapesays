import { fetchNews } from '../_lib/news.js';

export async function onRequest() {
	const data = await fetchNews(30);
	return new Response(JSON.stringify(data), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=30',
			'access-control-allow-origin': '*',
		},
	});
}
