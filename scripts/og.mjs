/**
 * Per-page Open Graph images.
 *
 * Every page shipped the same og-default.png, which meant a link to a specific
 * piece of research looked identical on X to a link to the home page. Nearly all
 * of this site's traffic arrives through one shared link at a time, and the card
 * image is most of what decides whether that link gets opened.
 *
 * Rendered with headless Chrome against the site's own type and colours rather
 * than drawn in a canvas API: the template is HTML, so it stays readable and the
 * output matches what the page looks like when the reader lands.
 *
 * Deliberately static. A card carrying a live price would be wrong the day after
 * it was generated and there is no way to refresh what X has already cached — so
 * the figure on the card is the finding, which does not move. Run it by hand
 * when a post is added:  npm run og
 *
 * The figures on the default and dca cards are read from src/data/dca.json rather
 * than typed in, because they were typed in once and went stale the next snapshot.
 * The candles behind every card are real BTC daily bars from
 * src/data/og-candles.json, not a decorative squiggle: this site does not draw
 * price shapes it did not fetch. Refresh them with  npm run og:candles
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DCA = JSON.parse(readFileSync('src/data/dca.json', 'utf8'));
const CANDLES = JSON.parse(readFileSync('src/data/og-candles.json', 'utf8')).bars;
const BAND_BARS = 96;
const BAND_NOTE = `BTC/USDT  ${BAND_BARS} daily bars to ${new Date(CANDLES[CANDLES.length - 1].t)
	.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'public/og';
const W = 1200, H = 630;

/** Front matter, shallow. Only the four scalar keys this needs. */
function fm(src) {
	const m = src.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return {};
	const out = {};
	for (const line of m[1].split('\n')) {
		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (!kv) continue;
		out[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
	}
	return out;
}

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The candle field behind the card. Real BTC daily bars, scaled into the top
 * band so the headline and the figure below it keep a quiet background. Drawn as
 * SVG inside the template so a card is still one screenshot and the colours
 * track the site's own up/down pair.
 */
function candles(h = 296, n = BAND_BARS) {
	const bars = CANDLES.slice(-n);
	const hi = Math.max(...bars.map((b) => b.h));
	const lo = Math.min(...bars.map((b) => b.l));
	const pad = (hi - lo) * 0.07;
	const top = hi + pad, bot = lo - pad;
	const y = (v) => (((top - v) / (top - bot)) * h).toFixed(1);
	const step = W / bars.length;
	const bw = Math.max(3, step * 0.6);
	let out = '';
	for (let i = 0; i < bars.length; i++) {
		const b = bars[i];
		const x = i * step + step / 2;
		// one hue, two values: the card reads as the site's amber at a glance and an
		// up bar is still distinguishable from a down bar at timeline size
		const col = b.c >= b.o ? '#f0b90b' : '#7d5f14';
		const yo = ((top - b.o) / (top - bot)) * h;
		const yc = ((top - b.c) / (top - bot)) * h;
		// a doji still needs a visible body, or the field reads as gaps
		const bodyH = Math.max(1.6, Math.abs(yc - yo));
		out += `<line x1="${x.toFixed(1)}" y1="${y(b.h)}" x2="${x.toFixed(1)}" y2="${y(b.l)}" stroke="${col}" stroke-width="1.5"/>`;
		out += `<rect x="${(x - bw / 2).toFixed(1)}" y="${Math.min(yo, yc).toFixed(1)}" width="${bw.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${col}"/>`;
	}
	return `<svg class="candles" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">${out}</svg>`;
}

/**
 * One template. The headline sizes itself down as it gets longer — a fixed size
 * either wraps to four lines on the long titles or wastes half the card on the
 * short ones.
 */
function html({ kicker, title, stat, statLabel }) {
	const n = Math.max(...title.split('\n').map((l) => l.length)) * title.split('\n').length;
	const size = n > 54 ? 62 : n > 38 ? 72 : 84;
	const wrap = title.includes('\n') ? '100%' : '17ch';
	return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
	* { margin: 0; box-sizing: border-box; }
	body {
		width: ${W}px; height: ${H}px; background: #08090b; color: #e9ecf1;
		font-family: Archivo, system-ui, sans-serif; position: relative; overflow: hidden;
		padding: 66px 72px 104px; display: flex; flex-direction: column;
	}
	.bg { position: absolute; inset: 0; opacity: 0.5;
		background:
			radial-gradient(900px 420px at 78% 8%, rgba(240,185,11,0.16), transparent 60%),
			radial-gradient(700px 400px at 8% 100%, rgba(240,185,11,0.06), transparent 62%);
	}
	/* real BTC daily bars, faded out before they reach the headline */
	.candles { position: absolute; top: 4px; left: 0; opacity: 0.72;
		-webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 100%);
		mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0) 100%); }
	/* the band is real data, so it gets an axis note like every chart on the site */
	.srcline { position: absolute; right: 72px; top: 268px; font-family: 'Roboto Mono', monospace;
		font-size: 15px; letter-spacing: 0.06em; color: #4d5462; }
	/* the text sits on this, not on the candles */
	.scrim { position: absolute; inset: 0;
		background: linear-gradient(to top, #08090b 24%, rgba(8,9,11,0.92) 41%, rgba(8,9,11,0) 70%); }
	.rule { position: absolute; left: 0; top: 0; width: 100%; height: 5px;
		background: linear-gradient(90deg, #f0b90b 0%, #f0b90b 46%, #7d5f14 46%, #7d5f14 62%, #1d2128 62%); }
	.top { position: relative; display: flex; align-items: center; gap: 13px;
		font-family: 'Roboto Mono', monospace; font-size: 20px; letter-spacing: 0.16em;
		text-transform: uppercase; color: #8a93a3; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #f0b90b; }
	/* headline sits with the figure, not floating midway: the kicker holds the top,
	   everything that carries meaning groups against the bottom edge */
	h1 { position: relative; font-size: ${size}px; font-weight: 700; line-height: 1.1;
		white-space: pre-line;
		letter-spacing: -0.032em; margin-top: auto; max-width: ${wrap}; }
	.foot { position: relative; margin-top: 46px; display: flex; align-items: flex-end;
		justify-content: space-between; gap: 30px; }
	.statwrap { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
	.stat { font-family: 'Roboto Mono', monospace; font-size: 56px; font-weight: 500;
		color: #f0b90b; letter-spacing: -0.02em; line-height: 1; }
	.lbl { font-family: 'Roboto Mono', monospace; font-size: 19px; color: #8a93a3;
		letter-spacing: 0.02em; }
	.dom { font-family: 'Roboto Mono', monospace; font-size: 21px; color: #59606e;
		white-space: nowrap; padding-bottom: 4px; }
</style></head><body>
<div class="bg"></div>${candles()}<div class="scrim"></div><div class="rule"></div>
<div class="srcline">${esc(BAND_NOTE)}</div>
<div class="top"><span class="dot"></span><span>${esc(kicker)}</span></div>
<h1>${esc(title)}</h1>
<div class="foot">
	<div class="statwrap">
		${stat ? `<div class="stat">${esc(stat)}</div>` : ''}
		${statLabel ? `<div class="lbl">${esc(statLabel)}</div>` : ''}
	</div>
	<div class="dom">thetapesays.com</div>
</div>
</body></html>`;
}

function shoot(doc, outPath) {
	const tmp = join(tmpdir(), `og-${Math.random().toString(36).slice(2)}.html`);
	writeFileSync(tmp, doc);
	execFileSync(CHROME, [
		'--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
		`--screenshot=${outPath}`, `--window-size=${W},${H}`,
		// Google Fonts has to land before the shot, or the card ships in Helvetica
		'--virtual-time-budget=4000',
		`file://${tmp}`,
	], { stdio: ['ignore', 'ignore', 'pipe'] });
}

// ---- pages without a post behind them ----
const PAGES = [
	// The home card carries the DCA comparison because it is the one finding on the
	// site that a stranger can check against their own account in about a minute.
	// Read from the snapshot, never typed: the hand-typed pair went stale in a week.
	{ slug: 'default', kicker: 'numbers first',
	  title: 'Every fill. Every loss.\nEvery trade is on the site.',
	  stat: `+${DCA.ret.toFixed(1)}% vs +${DCA.lumpRet.toFixed(1)}%`,
	  statLabel: `${DCA.spanDays} days, ${DCA.buys} fills, and every trade and backtest behind it` },
	{ slug: 'data', kicker: 'data', title: 'Chain state, miner economics, funding across six venues.',
	  stat: 'free, no signup', statLabel: 'every source named on the page' },
	{ slug: 'positions', kicker: 'positions', title: 'Every closed trade, from the exchange record.',
	  stat: 'losses included', statLabel: 'rules written down before the entry' },
	{ slug: 'dca', kicker: 'dca', title: 'Buying on schedule, and the alternative it beat.',
	  stat: `+${DCA.ret.toFixed(1)}% vs +${DCA.lumpRet.toFixed(1)}%`,
	  statLabel: `${DCA.buys} weekly buys against one purchase on day one` },
	{ slug: 'research', kicker: 'research', title: 'Backtests that name their data and their window.',
	  stat: 'rerunnable', statLabel: 'method stated, sample size stated' },
	{ slug: 'events', kicker: 'news', title: 'What moved, and what the tape actually did about it.',
	  stat: 'measured', statLabel: 'market reaction against exchange data, window named' },
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

let n = 0;
for (const p of PAGES) {
	shoot(html(p), `${OUT}/${p.slug}.png`);
	console.log(`[og] ${p.slug}.png`);
	n++;
}

for (const file of readdirSync('src/content/posts').filter((f) => f.endsWith('.md'))) {
	const meta = fm(readFileSync(join('src/content/posts', file), 'utf8'));
	if (!meta.title) continue;
	const slug = file.replace(/\.md$/, '');
	shoot(html({
		kicker: meta.kind || 'research',
		title: meta.title,
		stat: meta.stat,
		statLabel: meta.statLabel,
	}), `${OUT}/${slug}.png`);
	console.log(`[og] ${slug}.png  ${meta.stat ?? ''}`);
	n++;
}
console.log(`[og] ${n} cards written to ${OUT}`);
