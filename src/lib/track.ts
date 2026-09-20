/**
 * Usage analytics, cookieless.
 *
 * Three questions this has to answer and page-view counting cannot: which
 * panels people actually switch between, whether anyone reaches the referral
 * banner, and whether a page is read or bounced. So it records interactions and
 * a single end-of-visit engagement record rather than a stream of events.
 *
 * Nothing identifying is collected — no cookie, no id, no fingerprint. A visit
 * is only ever a path, a referrer host, and how long the tab was actually
 * visible. Sampling and retention live server-side in functions/api/beacon.js.
 */

type Payload = Record<string, string | number | undefined>;

const ENDPOINT = '/api/beacon';

/**
 * Opting a browser out of its own numbers.
 *
 * The author is the site's heaviest visitor by far, and with no id in the
 * payload there is no way to subtract him afterwards: a check-the-deploy visit
 * is indistinguishable from a reader's. Filtering by country in the query was
 * the alternative, and it would throw away real traffic from wherever the proxy
 * happens to exit that week.
 *
 * So the opt-out happens before anything is sent. Visit /?optout=1 once per
 * browser and this one stops reporting entirely; /?optout=0 turns it back on.
 * The flag is a single localStorage key, which is exactly the kind of
 * per-viewer preference that storage is for, and it is read in a try/catch
 * because private windows throw on access.
 */
const OPTOUT_KEY = 'tts:optout';

function optedOut(): boolean {
	try {
		const p = new URLSearchParams(location.search).get('optout');
		if (p === '1' || p === '0') {
			if (p === '1') localStorage.setItem(OPTOUT_KEY, '1');
			else localStorage.removeItem(OPTOUT_KEY);
		}
		return localStorage.getItem(OPTOUT_KEY) === '1';
	} catch {
		return false;
	}
}

let muted = false;
/** Events queue until idle so tracking never competes with rendering. */
let queue: Payload[] = [];
let flushing = false;

function post(batch: Payload[]) {
	if (muted || !batch.length) return;
	const body = JSON.stringify({ events: batch, path: location.pathname });
	// sendBeacon survives the page being closed; fetch is the fallback for the
	// (rare) engines without it, and must be keepalive for the same reason
	if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
	fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
		.catch(() => {});
}

function flush(now = false) {
	if (!queue.length) return;
	const batch = queue;
	queue = [];
	flushing = false;
	if (now) return post(batch);
	(window.requestIdleCallback ?? setTimeout)(() => post(batch), { timeout: 2000 } as any);
}

export function track(event: string, data: Payload = {}) {
	queue.push({ event, ...data, t: Date.now() });
	if (flushing) return;
	flushing = true;
	setTimeout(() => flush(), 1200);
}

/** Time the tab was actually in the foreground, not wall-clock since load. */
let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
let dwell = 0;
let maxDepth = 0;

function measureDepth() {
	const h = document.documentElement.scrollHeight - innerHeight;
	const d = h > 0 ? Math.min(100, Math.round(((scrollY || 0) / h) * 100)) : 100;
	if (d > maxDepth) maxDepth = d;
}

/**
 * The visit record is the denominator of every rate in the reports, so there
 * has to be exactly one per page life — and there was not. endVisit runs on
 * both `hidden` and `pagehide`, and `hidden` runs again every time the reader
 * comes back and leaves again, so a single visit landed three or four times.
 * That drags average dwell down and bounce rate up at the same time, which is
 * worse than either alone: two numbers wrong in opposite directions cannot be
 * reasoned back to the truth.
 *
 * Sending once undercounts a reader who leaves and returns to keep reading.
 * That is a bias in one direction with a known sign, which is the kind of
 * wrongness a number can carry and still be worth publishing.
 */
let visitSent = false;

function endVisit() {
	if (visibleSince) {
		dwell += Date.now() - visibleSince;
		visibleSince = 0;
	}
	measureDepth();
	// interactions still go out on every exit — it is only the visit that is
	// once, so something clicked after a return trip is not lost
	const batch = queue;
	queue = [];
	if (!visitSent) {
		visitSent = true;
		batch.unshift({ event: 'visit', dwell: Math.round(dwell / 1000), depth: maxDepth, t: Date.now() });
	}
	post(batch);
}

export function initTracking() {
	muted = optedOut();
	if (muted) return;

	const ref = document.referrer;
	let refHost = '';
	try {
		if (ref) {
			const u = new URL(ref);
			// own-site navigation isn't a referrer worth storing
			if (u.host !== location.host) refHost = u.host;
		}
	} catch {}
	track('view', { ref: refHost, w: innerWidth });

	addEventListener('scroll', measureDepth, { passive: true });

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			if (visibleSince) dwell += Date.now() - visibleSince;
			visibleSince = 0;
			endVisit();
		} else {
			visibleSince = Date.now();
		}
	});
	// pagehide is the one that fires reliably on mobile; unload does not
	addEventListener('pagehide', endVisit);

	/**
	 * Clicks worth counting, resolved from the DOM rather than hand-tagged, so a
	 * new tab or button is measured the day it ships:
	 *   - the referral link (the only conversion on the site)
	 *   - any outbound link
	 *   - the switchers the dashboards are built out of
	 */
	document.addEventListener(
		'click',
		(e) => {
			const el = (e.target as HTMLElement)?.closest?.(
				'a, button, [data-track], [role="tab"]',
			) as HTMLElement | null;
			if (!el) return;

			const explicit = el.dataset.track;
			const link = el as HTMLAnchorElement;
			const href = link.href || '';

			if (el.matches('a[rel~="sponsored"]') || el.closest('[data-ref]')) {
				track('referral', { label: explicit ?? el.textContent?.trim().slice(0, 40) ?? '', href });
				return;
			}
			if (explicit) return track('click', { label: explicit, href });
			if (href && !href.startsWith(location.origin) && !href.startsWith('#')) {
				return track('outbound', { href, label: el.textContent?.trim().slice(0, 40) ?? '' });
			}
			// a switcher: record which control and which value
			const ds = el.dataset;
			const key = Object.keys(ds).find((k) =>
				/^(tsym|fsym|osym|cpsym|range|cmRange|filter|sort|dot|tab)$/.test(k),
			);
			if (key) track('switch', { label: key, value: String(ds[key]) });
		},
		{ capture: true, passive: true },
	);
}
