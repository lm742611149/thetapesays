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
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
 * One template. The headline sizes itself down as it gets longer — a fixed size
 * either wraps to four lines on the long titles or wastes half the card on the
 * short ones.
 */
function html({ kicker, title, stat, statLabel }) {
	const n = title.length;
	const size = n > 54 ? 62 : n > 38 ? 72 : 84;
	return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
	* { margin: 0; box-sizing: border-box; }
	body {
		width: ${W}px; height: ${H}px; background: #08090b; color: #e9ecf1;
		font-family: Archivo, system-ui, sans-serif; position: relative; overflow: hidden;
		padding: 66px 72px; display: flex; flex-direction: column;
	}
	/* the faint candle field the site carries behind its panels */
	.bg { position: absolute; inset: 0; opacity: 0.5;
		background:
			radial-gradient(900px 420px at 78% 8%, rgba(240,185,11,0.10), transparent 60%),
			radial-gradient(700px 400px at 8% 100%, rgba(122,162,255,0.08), transparent 62%);
	}
	.rule { position: absolute; left: 0; top: 0; width: 100%; height: 5px;
		background: linear-gradient(90deg, #f0b90b 0%, #f0b90b 34%, #7aa2ff 34%, #7aa2ff 52%, #1d2128 52%); }
	.top { position: relative; display: flex; align-items: center; gap: 13px;
		font-family: 'Roboto Mono', monospace; font-size: 20px; letter-spacing: 0.16em;
		text-transform: uppercase; color: #8a93a3; }
	.dot { width: 9px; height: 9px; border-radius: 50%; background: #f0b90b; }
	/* headline sits with the figure, not floating midway: the kicker holds the top,
	   everything that carries meaning groups against the bottom edge */
	h1 { position: relative; font-size: ${size}px; font-weight: 700; line-height: 1.1;
		letter-spacing: -0.032em; margin-top: auto; max-width: 17ch; }
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
<div class="bg"></div><div class="rule"></div>
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
	{ slug: 'default', kicker: 'numbers first', title: 'First-hand market data on crypto and macro.',
	  stat: 'no signals', statLabel: 'backtests you can rerun, positions posted before the move' },
	{ slug: 'data', kicker: 'data', title: 'Chain state, miner economics, funding across six venues.',
	  stat: 'free, no signup', statLabel: 'every source named on the page' },
	{ slug: 'positions', kicker: 'positions', title: 'Every closed trade, from the exchange record.',
	  stat: 'losses included', statLabel: 'rules written down before the entry' },
	{ slug: 'dca', kicker: 'dca', title: 'Buying on schedule, and the alternative it beat.',
	  stat: '+25.0% vs +7.9%', statLabel: 'six months of weekly buying against day one' },
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
