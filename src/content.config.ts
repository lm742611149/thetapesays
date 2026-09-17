import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		/** research = a measurement; log = a position or its outcome; note = short. */
		kind: z.enum(['research', 'log', 'note']).default('research'),
		tags: z.array(z.string()).default([]),
		/** Headline figure shown on cards, e.g. "0.29x vs 7.90x". */
		stat: z.string().optional(),
		statLabel: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

export const collections = { posts };
