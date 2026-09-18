/**
 * Listed companies holding BTC or ETH on the balance sheet.
 *
 * CoinGecko publishes cost basis for some filers and not others — a zero entry
 * value means "not disclosed to them", not "bought at zero". Those rows keep
 * their holdings and drop the P&L rather than being shown at a fabricated
 * -100%, which is what taking the number at face value would print.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = {
	headers: { 'user-agent': UA, accept: 'application/json' },
	cf: { cacheTtl: 60, cacheEverything: true },
};

export const COINS = { BTC: 'bitcoin', ETH: 'ethereum' };
export const TREASURY_URL = (coin) =>
	`https://api.coingecko.com/api/v3/companies/public_treasury/${COINS[coin] ?? 'bitcoin'}`;

const J = async (url) => {
	const r = await fetch(url, opts);
	if (!r.ok) throw new Error(`${r.status}`);
	return r.json();
};

/** Pure: the same shaping runs in the browser when the edge function is out. */
export function derive(d, coin, limit = 12) {
	const rows = (d.companies ?? []).map((c) => {
		const entry = c.total_entry_value_usd > 0 ? c.total_entry_value_usd : null;
		const value = c.total_current_value_usd;
		return {
			name: c.name,
			// "MSTR.US" — the exchange suffix is noise next to the company name
			symbol: String(c.symbol ?? '').split(':').pop().replace(/\.[A-Z]+$/, ''),
			country: c.country,
			holdings: c.total_holdings,
			valueUsd: value,
			// cost basis per coin, not the total — comparable across filers
			entryPrice: entry && c.total_holdings ? entry / c.total_holdings : null,
			pnl: entry ? value / entry - 1 : null,
			supplyPct: c.percentage_of_total_supply,
		};
	});

	return {
		ts: Date.now(),
		coin,
		totalHoldings: d.total_holdings,
		totalValueUsd: d.total_value_usd,
		supplyPct: d.market_cap_dominance,
		count: rows.length,
		rows: rows.slice(0, limit),
	};
}

export async function treasuries(coin = 'BTC') {
	return derive(await J(TREASURY_URL(coin)), coin);
}
