import type { APIRoute } from "astro";
import { sortedArticles } from "../lib/articles";

const escapeXml = (value: string) => value
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;")
	.replaceAll("'", "&apos;");

export const GET: APIRoute = () => {
	const items = sortedArticles.map((article) => `
		<item>
			<title>${escapeXml(article.title)}</title>
			<link>https://rrrayy.github.io/blog/${article.slug}/</link>
			<guid isPermaLink="true">https://rrrayy.github.io/blog/${article.slug}/</guid>
			<pubDate>${new Date(article.date.replace(" ", "T") + (article.date.length === 10 ? "T00:00:00Z" : "Z")).toUTCString()}</pubDate>
			<description>${escapeXml(article.summary)}</description>
			<category>${escapeXml(article.category)}</category>
		</item>`).join("");

	return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
	<title>Rray 技术文章</title>
	<link>https://rrrayy.github.io/</link>
	<description>C++ 系统工程、分布式通信与 Agent 后端实践。</description>
	<language>zh-CN</language>${items}
</channel></rss>`, {
		headers: { "Content-Type": "application/xml; charset=utf-8" }
	});
};
