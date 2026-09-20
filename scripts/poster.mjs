/**
 * The image that rides along with a post. No text, no axis, no figure.
 *
 * A single object in a lit room, not a texture: earlier passes got the metal
 * right and still read as wallpaper, because a frame with no subject has nothing
 * for the eye to land on at thumbnail size.
 *
 * The surface is rendered rather than drawn. feTurbulence builds a height field
 * and feDiffuseLighting / feSpecularLighting light it. surfaceScale stays small
 * and the field is blurred first: a large surfaceScale over 8-bit noise quantises
 * into contour rings, which is what made the first two molten passes look cheap.
 *
 *   node scripts/poster.mjs   ->  public/og/poster.png
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'public/og/poster.png';
const W = 1600, H = 900;
const CX = 828, CY = 430, R = 306;

let seed = 20260920;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

let dust = '';
for (let i = 0; i < 260; i++) {
	const a = rnd() * Math.PI * 2, d = R * (1.12 + Math.pow(rnd(), 0.6) * 1.5);
	const x = CX + Math.cos(a) * d * 1.3, y = CY + Math.sin(a) * d * 0.82;
	if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
	dust += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + rnd() * 1.9).toFixed(2)}" fill="#ffe9a8" opacity="${(0.06 + rnd() * 0.4).toFixed(2)}"/>`;
}

const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
	* { margin: 0; box-sizing: border-box; }
	body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
		background:
			radial-gradient(1500px 900px at 24% 16%, #3d2a09 0%, #241804 42%, #120c03 76%, #0a0702 100%); }
	svg { position: absolute; inset: 0; }
	.cast { position: absolute; left: ${CX - R * 2.2}px; top: ${CY + R * 0.72}px; width: ${R * 4.4}px; height: ${R * 1.5}px;
		background: radial-gradient(closest-side, rgba(240,185,11,0.34), transparent 72%); filter: blur(24px); }
	.air { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
		background: radial-gradient(760px 620px at ${CX - R * 0.55}px ${CY - R * 0.6}px, rgba(255,238,180,0.26), transparent 62%); }
	.vig { position: absolute; inset: 0; pointer-events: none;
		background: radial-gradient(128% 116% at 46% 44%, transparent 44%, rgba(4,3,1,0.82) 100%); }
</style></head><body>
<div class="cast"></div>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
	<defs>
		<filter id="molten" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
			<feTurbulence type="fractalNoise" baseFrequency="0.0042 0.0058" numOctaves="4" seed="11" result="h"/>
			<feGaussianBlur in="h" stdDeviation="7.5" result="hs"/>
			<feDiffuseLighting in="hs" lighting-color="#d89c0c" surfaceScale="13" diffuseConstant="1.0" result="body">
				<feDistantLight azimuth="228" elevation="48"/>
			</feDiffuseLighting>
			<feSpecularLighting in="hs" lighting-color="#fff7db" surfaceScale="13" specularConstant="1.15" specularExponent="30" result="gloss">
				<feDistantLight azimuth="228" elevation="64"/>
			</feSpecularLighting>
			<feComposite in="gloss" in2="body" operator="arithmetic" k1="0" k2="0.9" k3="1" k4="0"/>
		</filter>
		<clipPath id="ball"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
		<!-- the sphere: key light upper left, terminator lower right, and a rim
		     bounce so the dark limb does not merge into the room -->
		<radialGradient id="shade" cx="32%" cy="27%" r="86%">
			<stop offset="0%" stop-color="#fff" stop-opacity="0.62"/>
			<stop offset="34%" stop-color="#fff" stop-opacity="0.05"/>
			<stop offset="72%" stop-color="#1a1103" stop-opacity="0.66"/>
			<stop offset="100%" stop-color="#0a0701" stop-opacity="0.92"/>
		</radialGradient>
		<radialGradient id="rim" cx="72%" cy="78%" r="52%">
			<stop offset="0%" stop-color="#ffcf5e" stop-opacity="0.55"/>
			<stop offset="62%" stop-color="#ffcf5e" stop-opacity="0.06"/>
			<stop offset="100%" stop-color="#ffcf5e" stop-opacity="0"/>
		</radialGradient>
		<filter id="halo" x="-60%" y="-60%" width="220%" height="220%">
			<feGaussianBlur stdDeviation="46"/>
		</filter>
	</defs>
	<g opacity="0.9">${dust}</g>
	<circle cx="${CX}" cy="${CY}" r="${R + 14}" fill="#f0b90b" opacity="0.26" filter="url(#halo)"/>
	<g clip-path="url(#ball)">
		<rect x="${CX - R}" y="${CY - R}" width="${R * 2}" height="${R * 2}" filter="url(#molten)"/>
		<circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#shade)"/>
		<circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#rim)"/>
	</g>
	<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#ffe08a" stroke-width="1.4" opacity="0.4"/>
</svg>
<div class="air"></div>
<div class="vig"></div>
</body></html>`;

const tmp = join(tmpdir(), `poster-${Math.random().toString(36).slice(2)}.html`);
writeFileSync(tmp, doc);
execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
	`--screenshot=${OUT}`, `--window-size=${W},${H}`, '--virtual-time-budget=4000', `file://${tmp}`],
	{ stdio: ['ignore', 'ignore', 'pipe'] });
console.log(`[poster] ${OUT}`);
