/**
 * RSS aggregation. Workers have no DOMParser, so items are pulled with
 * targeted regexes rather than a real XML parse — these four feeds are
 * well-formed and we only need three fields each.
 */
export const FEEDS = [
	['Cointelegraph', 'https://cointelegraph.com/rss'],
	['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
	['Decrypt', 'https://decrypt.co/feed'],
	['The Block', 'https://www.theblock.co/rss.xml'],
];

const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';

/** Feeds double-encode ("&amp;#39;"), so entities are decoded twice. */
const decode = (s) =>
	s
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

const strip = (s) =>
	decode(decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')))
		.replace(/\s+/g, ' ')
		.trim();

const pick = (block, tag) => {
	const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
	return m ? strip(m[1]) : '';
};

function parse(xml, source) {
	const out = [];
	const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
	for (const block of items.slice(0, 60)) {
		const title = pick(block, 'title');
		let link = pick(block, 'link');
		if (!link) {
			const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
			if (href) link = href[1];
		}
		const date = pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'dc:date');
		const ts = date ? Date.parse(date) : NaN;
		if (!title || !link) continue;
		out.push({ source, title, link, ts: Number.isFinite(ts) ? ts : Date.now() });
	}
	return out;
}

export async function fetchNews(limit = 120) {
	const results = await Promise.allSettled(
		FEEDS.map(async ([name, url]) => {
			const r = await fetch(url, {
				headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' },
				cf: { cacheTtl: 60, cacheEverything: true },
			});
			if (!r.ok) throw new Error(`${name} ${r.status}`);
			return parse(await r.text(), name);
		}),
	);

	const all = [];
	const errors = [];
	results.forEach((res, i) => {
		if (res.status === 'fulfilled') all.push(...res.value);
		else errors.push(`${FEEDS[i][0]}: ${res.reason?.message ?? 'failed'}`);
	});

	// de-dup on a normalised title — the same wire gets rewritten by everyone
	const seen = new Set();
	const items = all
		.sort((a, b) => b.ts - a.ts)
		.filter((it) => {
			const k = it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 42);
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		})
		.slice(0, limit);

	return { items, errors, ts: Date.now() };
}
