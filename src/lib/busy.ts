/**
 * One switch for every in-panel loading veil (see `components/Busy.astro`).
 *
 * The two delays are what keep it from being worse than no spinner at all: a
 * cached response lands in tens of milliseconds, and a veil that appears and
 * vanishes inside that window reads as a flicker, not as progress. So the veil
 * waits before showing, and once shown it stays long enough to be legible.
 */

/** Wait this long before showing anything — most responses beat it. */
const DELAY = 160;
/** Once visible, hold at least this long. */
const MIN = 420;

/** Runs `fn`, showing `el`'s veil for the parts of it a person would notice. */
export async function withBusy<T>(el: HTMLElement | null, fn: () => Promise<T>): Promise<T> {
	if (!el) return fn();

	let shown = 0;
	const timer = window.setTimeout(() => {
		shown = Date.now();
		el.setAttribute('data-busy', '');
	}, DELAY);

	try {
		return await fn();
	} finally {
		clearTimeout(timer);
		if (!shown) {
			el.removeAttribute('data-busy');
		} else {
			const left = Math.max(0, MIN - (Date.now() - shown));
			window.setTimeout(() => el.removeAttribute('data-busy'), left);
		}
	}
}
