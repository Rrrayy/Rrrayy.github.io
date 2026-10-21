import type { APIRoute } from "astro";
import { sortedArticles, categorySlug, tagSlug } from "../lib/articles";

const siteUrl = "https://rrrayy.github.io";

export const GET: APIRoute = () => {
	const staticPaths = ["/", "/blog/", "/blog/tags/", "/projects/", "/projects/rpc/", "/projects/evidenceops/", "/applications/job-desk/"];
	const categoryPaths = [...new Set(sortedArticles.map((article) => article.category))].map((category) => `/blog/category/${categorySlug(category)}/`);
	const tagPaths = [...new Set(sortedArticles.flatMap((article) => article.tags))].map((tag) => `/blog/tag/${tagSlug(tag)}/`);
	const articlePaths = sortedArticles.map((article) => `/blog/${article.slug}/`);
	const urls = [...staticPaths, ...categoryPaths, ...tagPaths, ...articlePaths];
	const entries = urls.map((path) => `
	<url><loc>${siteUrl}${path}</loc></url>`).join("");

	return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}
</urlset>`, {
		headers: { "Content-Type": "application/xml; charset=utf-8" }
	});
};
