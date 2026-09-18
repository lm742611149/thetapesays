const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
/**
 * Edge quote proxy. The browser never talks to an exchange directly —
 * keeps the page working where Binance is blocked, and lets one cached
 * response serve every visitor.
 */
const SYMBOLS = [
	'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
	'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT', 'SUIUSDT', 'DOTUSDT',
	'LTCUSDT', 'TRXUSDT', 'NEARUSDT', 'APTUSDT',
];

async function fromBinance() {
	const q = encodeURIComponent(JSON.stringify(SYMBOLS));
	const r = await fetch(`https://data-api.binance.vision/api/v3/ticker/24hr?symbols=${q}`, {
		headers: { 'user-agent': UA },
		cf: { cacheTtl: 3, cacheEverything: true },
	});
	if (!r.ok) throw new Error(`binance ${r.status}`);
	const rows = await r.json();
	return rows.map((d) => ({
		sym: d.symbol.replace('USDT', ''),
		price: Number(d.lastPrice),
		chg: Number(d.priceChangePercent),
	}));
}

async function fromCoinbase() {
	const pairs = { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
	const out = [];
	for (const [sym, pair] of Object.entries(pairs)) {
		const r = await fetch(`https://api.exchange.coinbase.com/products/${pair}/stats`, {
			headers: { 'user-agent': UA },
			headers: { 'user-agent': UA },
		cf: { cacheTtl: 3, cacheEverything: true },
		});
		if (!r.ok) continue;
		const d = await r.json();
		const last = Number(d.last);
		const open = Number(d.open);
		out.push({ sym, price: last, chg: open ? ((last - open) / open) * 100 : 0 });
	}
	if (!out.length) throw new Error('coinbase empty');
	return out;
}

export async function onRequest() {
	let quotes = null;
	let source = null;
	for (const [name, fn] of [
		['binance', fromBinance],
		['coinbase', fromCoinbase],
	]) {
		try {
			quotes = await fn();
			source = name;
			break;
		} catch {
			/* try the next one */
		}
	}
	const body = JSON.stringify({ quotes: quotes ?? [], source, ts: Date.now() });
	return new Response(body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=15, s-maxage=15',
			'access-control-allow-origin': '*',
		},
	});
}
