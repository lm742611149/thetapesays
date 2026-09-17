// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import trades from './src/data/trades.json' with { type: 'json' };
import { defineConfig, fontProviders } from 'astro/config';

const SITE = 'https://thetapesays.com';

export default defineConfig({
	site: SITE,
	// bind every interface so other devices on the LAN can open the dev server
	server: { host: true, port: 4321 },
	integrations: [
		mdx(),
		sitemap({
			// the trade log is a draft until its prices are reconciled; keep it out
			// of the sitemap rather than inviting crawlers to an unchecked record
			filter: (page) =>
				!page.includes('/404') && (trades.verified || !page.includes('/positions')),
		}),
	],
	markdown: {
		shikiConfig: { theme: 'css-variables', wrap: false },
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: 'Archivo',
			cssVariable: '--font-display',
			weights: [500, 600, 700],
			subsets: ['latin'],
			fallbacks: ['Helvetica Neue', 'system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Inter',
			cssVariable: '--font-body',
			weights: [400, 500, 600],
			subsets: ['latin'],
			fallbacks: ['system-ui', 'sans-serif'],
		},
		{
			provider: fontProviders.google(),
			name: 'Roboto Mono',
			cssVariable: '--font-mono',
			weights: [400, 500, 700],
			subsets: ['latin'],
			fallbacks: ['ui-monospace', 'SFMono-Regular', 'monospace'],
		},
	],
});
