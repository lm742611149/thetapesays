/**
 * Bitcoin network state and the miner economics that fall out of it.
 *
 * One upstream call carries the lot. Blockchair publishes the chain tip,
 * difficulty, 24h hashrate, mempool and the fee averages in a single stats
 * document, which matters here because every derived number below has to be
 * computed off the same instant — a hashrate from one moment divided into an
 * issuance from another is a number that was never true.
 *
 * Nothing here is a quoted figure: hashprice and shutdown prices are computed
 * from the chain's own state plus two stated assumptions (rig efficiency and
 * power price). The assumptions travel with the output so the page can print
 * them next to the numbers.
 */
const UA = 'Mozilla/5.0 (compatible; thetapesays/1.0; +https://thetapesays.com)';
const opts = {
	headers: { 'user-agent': UA, accept: 'application/json' },
	cf: { cacheTtl: 10, cacheEverything: true },
};

const J = async (url) => {
	const r = await fetch(url, opts);
	if (!r.ok) throw new Error(`${r.status}`);
	return r.json();
};

const SAT = 1e8;
/** Joules per terahash. Public spec sheets; the wall figure, not the chip. */
export const RIGS = [
	{ name: 'S21 XP', jth: 13.5 },
	{ name: 'S21 Pro', jth: 15 },
	{ name: 'S21', jth: 17.5 },
	{ name: 'S19 XP', jth: 21.5 },
	{ name: 'S19k Pro', jth: 23 },
	{ name: 'S19j Pro', jth: 29.5 },
];
/** All-in hosted power, $/kWh. Low = own hydro, high = US retail hosting. */
export const POWER = [0.03, 0.05, 0.07];

/**
 * kWh burned per terahash per day. A J/TH figure is joules per terahash, so a
 * day of it is jth * 86400 joules, and a kWh is 3.6e6 joules.
 */
const kwhPerThDay = (jth) => (jth * 86400) / 3.6e6;

export const STATS_URL = 'https://api.blockchair.com/bitcoin/stats';

export async function onchain() {
	return derive((await J(STATS_URL)).data);
}

/**
 * Everything above is a pure function of one stats document, so the browser can
 * run it too — when the edge function is unreachable the page fetches the same
 * upstream and derives the identical numbers rather than shipping a second,
 * drifting copy of these formulas.
 */
export function derive(s) {
	const height = s.blocks;
	const epoch = Math.floor(height / 210000);
	const subsidy = 50 / 2 ** epoch;
	const halvingHeight = (epoch + 1) * 210000;
	const blocksToHalving = halvingHeight - height;

	const hashrate = s.hashrate_24h;                       // H/s
	const hashrateEh = hashrate / 1e18;
	const hashrateTh = hashrate / 1e12;

	// Issuance is reported directly; fees have to be rebuilt from the averages.
	const subsidyBtcDay = s.inflation_24h / SAT;
	const feeBtcDay = (s.average_transaction_fee_24h * s.transactions_24h) / SAT;
	const minedBtcDay = subsidyBtcDay + feeBtcDay;

	const price = s.market_price_usd;
	const revenueUsdDay = minedBtcDay * price;
	// $ per petahash per day — the standard unit for comparing rigs and deals
	const hashprice = revenueUsdDay / (hashrate / 1e15);
	// what one TH of hashrate earns in a day, the denominator of every cost below
	const btcPerThDay = minedBtcDay / hashrateTh;

	/**
	 * The BTC price at which a rig's power bill equals what it mines. Below it
	 * the machine loses cash on every block and the rational move is to switch
	 * off — hardware cost is already sunk and does not enter.
	 */
	const shutdown = (jth, usdKwh) => (kwhPerThDay(jth) * usdKwh) / btcPerThDay;

	const grid = RIGS.map((rig) => ({
		...rig,
		cells: POWER.map((p) => {
			const at = shutdown(rig.jth, p);
			return { power: p, shutdown: Math.round(at), margin: price / at - 1 };
		}),
	}));

	const retargetPct = s.next_difficulty_estimate
		? (s.next_difficulty_estimate / s.difficulty - 1) * 100
		: null;

	return {
		ts: Date.now(),
		price,
		chain: {
			height,
			difficulty: s.difficulty,
			hashrateEh,
			retargetPct,
			retargetAt: s.next_retarget_time_estimate,
			mempoolTx: s.mempool_transactions,
			mempoolMb: s.mempool_size / 1e6,
			feeSatVb: s.suggested_transaction_fee_per_byte_sat,
			medianFeeSat: s.median_transaction_fee_24h,
			nodes: s.nodes,
			circulating: s.circulation / SAT,
			dominance: s.market_dominance_percentage,
			txDay: s.transactions_24h,
			blocksToHalving,
			halvingHeight,
			// ten minutes a block is the target, not the recent average
			halvingAt: Date.now() + blocksToHalving * 10 * 60 * 1000,
		},
		miner: {
			subsidy,
			subsidyBtcDay,
			feeBtcDay,
			minedBtcDay,
			feeShare: minedBtcDay ? (feeBtcDay / minedBtcDay) * 100 : 0,
			revenueUsdDay,
			hashprice,
			btcPerThDay,
			power: POWER,
			grid,
		},
	};
}
