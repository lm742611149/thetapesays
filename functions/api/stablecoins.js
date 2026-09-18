/**
 * Current stablecoin split. The home page and /data both show it, and the only
 * other route to it was the six-hourly snapshot.
 */
import { stablecoins } from '../_lib/stablecoins.js';

export async function onRequest() {
	try {
		// history is 100+ weeks of series and nothing live needs it
		const { chains, totalB, asOf, source } = await stablecoins({ lines: [] });
		return new Response(JSON.stringify({ chains, totalB, asOf, source }), {
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'cache-control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=30',
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
