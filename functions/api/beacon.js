/**
 * Analytics sink. Writes to an Analytics Engine dataset, which is built for
 * high-cardinality append-only event data and costs nothing at this volume —
 * a D1 table would work until it didn't.
 *
 * No identifier of any kind is stored. Country and device class come from
 * Cloudflare's own request properties, which are derived at the edge and never
 * tied back to an address. If the binding is missing the endpoint still returns
 * 204: analytics failing must never surface as a broken page.
 */
const MAX_EVENTS = 24;
const MAX_LEN = 120;

const clip = (v, n = MAX_LEN) => (typeof v === 'string' ? v.slice(0, n) : '');
const numeric = (v) => (Number.isFinite(+v) ? +v : 0);

export async function onRequestPost({ request, env }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(null, { status: 204 });
	}

	const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
	if (!events.length || !env.ANALYTICS) return new Response(null, { status: 204 });

	const cf = request.cf ?? {};
	const path = clip(body.path || '/', 160);
	const ua = request.headers.get('user-agent') ?? '';
	/**
	 * Headless browsers are dropped. Screenshotting the site during development
	 * executes its JavaScript and fires this endpoint, and a few dozen of those
	 * in an afternoon swamps the handful of real visits a new site gets — which
	 * is exactly what happened on 2026-09-18. A metric that counts its own
	 * author's test runs measures nothing.
	 */
	if (/HeadlessChrome|Puppeteer|Playwright|bot|crawler|spider|curl|wget/i.test(ua)) {
		return new Response(null, { status: 204 });
	}
	// device class, not a fingerprint
	const device = /iPhone|Android.*Mobile|Windows Phone/i.test(ua)
		? 'mobile'
		: /iPad|Tablet|Android/i.test(ua)
			? 'tablet'
			: 'desktop';

	for (const e of events) {
		try {
			env.ANALYTICS.writeDataPoint({
				blobs: [
					clip(e.event, 24),      // view | visit | click | switch | outbound | referral
					path,
					clip(e.label, 60),
					clip(e.value ?? e.href, 160),
					clip(e.ref, 80),        // referrer host, empty for direct
					clip(cf.country, 4),
					device,
				],
				doubles: [numeric(e.dwell), numeric(e.depth), numeric(e.w)],
				// indexed by path so "how did this page do" is the cheap query
				indexes: [path],
			});
		} catch {
			// a malformed point must not take the rest of the batch down
		}
	}

	return new Response(null, {
		status: 204,
		headers: { 'cache-control': 'no-store' },
	});
}

/** Anything other than POST gets a cheap no-op rather than an error page. */
export async function onRequest() {
	return new Response(null, { status: 204 });
}
