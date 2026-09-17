import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESC } from '../consts';
import { allPosts } from '../lib/posts';

export async function GET(context) {
	const posts = await allPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESC,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/research/${post.id}/`,
		})),
	});
}
