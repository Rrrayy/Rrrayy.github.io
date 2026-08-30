from pathlib import Path
import html
import json
import re
import shutil


root_dir=Path(__file__).resolve().parent
content_dir=root_dir/"content"
posts_dir=root_dir/"posts"
asset_dir=root_dir.parent/"assets"/"blog"
site_base="https://rrrayy.github.io/blog/posts/"

published_meta={
	"编译器工具链/GCC编译器完全上手指南.md":("2026-07-07 01:30:44","https://blog.csdn.net/rr666888/article/details/162645027"),
	"进程调度/Linux CFS 完全公平调度器深度拆解.md":("2026-07-09","https://blog.csdn.net/rr666888/article/details/162712345"),
	"内存管理/malloc(1) 背后的 brk 与 mmap.md":("2026-07-11","https://blog.csdn.net/rr666888/article/details/162793574"),
	"文件系统探秘/inode-硬链接-软链接探究.md":("2026-07-13","https://blog.csdn.net/rr666888/article/details/162816776"),
	"文件系统探秘/ext4文件系统详解-用dd和mkfs.ext4从零解剖.md":("2026-07-14","https://blog.csdn.net/rr666888/article/details/162878654"),
	"C++多线程编程/C++多线程入门-创建线程-加锁-计数.md":("2026-07-17","https://blog.csdn.net/rr666888/article/details/162950541"),
	"C++多线程编程/锁的进阶-自旋锁-死锁-条件变量.md":("2026-07-21","https://blog.csdn.net/rr666888/article/details/163084384"),
	"IO模型/零拷贝到底快在哪-sendfile-vs-read-write-benchmark.md":("2026-07-27","https://blog.csdn.net/rr666888/article/details/163222717"),
	"C++新特性/lambda闭包原理——函数怎么能带走局部变量.md":("2026-08-15","https://blog.csdn.net/rr666888/article/details/163764597"),
	"C++新特性/C++移动语义与完美转发.md":("2026-08-30","https://blog.csdn.net/rr666888/article/details/164191908")
}

slug_map={
	"编译器工具链/GCC编译器完全上手指南.md":"gcc-from-zero",
	"进程调度/Linux CFS 完全公平调度器深度拆解.md":"linux-cfs",
	"内存管理/malloc(1) 背后的 brk 与 mmap.md":"malloc-brk-mmap",
	"文件系统探秘/inode-硬链接-软链接探究.md":"inode-links",
	"文件系统探秘/ext4文件系统详解-用dd和mkfs.ext4从零解剖.md":"ext4-layout",
	"C++多线程编程/C++多线程入门-创建线程-加锁-计数.md":"cpp-threads",
	"C++多线程编程/锁的进阶-自旋锁-死锁-条件变量.md":"locks-and-condition-variables",
	"IO模型/零拷贝到底快在哪-sendfile-vs-read-write-benchmark.md":"zero-copy",
	"C++新特性/lambda闭包原理——函数怎么能带走局部变量.md":"lambda-closure",
	"C++新特性/C++移动语义与完美转发.md":"cpp-move-forward"
}

category_names={
	"编译器工具链":"编译器工具链",
	"进程调度":"操作系统",
	"内存管理":"内存管理",
	"文件系统探秘":"文件系统",
	"C++多线程编程":"并发编程",
	"C++新特性":"C++ 新特性",
	"IO模型":"IO 模型"
}


def parse_front_matter(raw_text):
	text=raw_text.lstrip("\ufeff")
	lines=text.splitlines()
	metadata={}
	if not lines or lines[0].strip()!="---":
		return metadata,text
	end_index=None
	for index in range(1,len(lines)):
		if lines[index].strip()=="---":
			end_index=index
			break
	if end_index is None:
		return metadata,text
	for line in lines[1:end_index]:
		match=re.match(r"^([A-Za-z_-]+):\s*(.*)$",line)
		if match:
			metadata[match.group(1).strip()]=match.group(2).strip().strip("\"'")
	return metadata,"\n".join(lines[end_index+1:])


def first_heading(text):
	match=re.search(r"^#\s+(.+?)\s*$",text,re.MULTILINE)
	return match.group(1).strip() if match else "未命名文章"


def strip_heading(text,title):
	lines=text.splitlines()
	for index,line in enumerate(lines):
		if re.match(r"^#\s+",line) and re.sub(r"[*_`]","",line[2:].strip())==re.sub(r"[*_`]","",title):
			return "\n".join(lines[:index]+lines[index+1:]).lstrip()
	return text.lstrip()


def image_url(url):
	clean_url=url.strip().replace("\\","/")
	if clean_url.startswith("images/"):
		return "../../assets/blog/"+Path(clean_url).name
	return clean_url


def inline_markup(text):
	value=html.escape(text,quote=False)
	tokens=[]

	def stash_code(match):
		tokens.append("<code>"+html.escape(match.group(1),quote=False)+"</code>")
		return f"@@CODE{len(tokens)-1}@@"

	value=re.sub(r"`([^`]+)`",stash_code,value)
	value=re.sub(r"!\[([^\]]*)\]\(([^)]+)\)",lambda match:f'<img src="{html.escape(image_url(match.group(2)),quote=True)}" alt="{match.group(1)}">',value)
	value=re.sub(r"\[([^\]]+)\]\(([^)]+)\)",lambda match:f'<a href="{html.escape(match.group(2),quote=True)}">{match.group(1)}</a>',value)
	value=re.sub(r"\*\*([^*]+)\*\*",r"<strong>\1</strong>",value)
	value=re.sub(r"__([^_]+)__",r"<strong>\1</strong>",value)
	value=re.sub(r"~~([^~]+)~~",r"<del>\1</del>",value)
	value=re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)",r"<em>\1</em>",value)
	for index,token in enumerate(tokens):
		value=value.replace(f"@@CODE{index}@@",token)
	return value


def render_table(lines):
	rows=[]
	for line in lines:
		cells=[cell.strip() for cell in line.strip().strip("|").split("|")]
		if cells and not all(re.match(r"^:?-{3,}:?$",cell) for cell in cells):
			rows.append(cells)
	if not rows:
		return ""
	output=["<div class=\"table_wrap\"><table><thead><tr>"]
	output.extend(f"<th>{inline_markup(cell)}</th>" for cell in rows[0])
	output.append("</tr></thead><tbody>")
	for row in rows[1:]:
		output.append("<tr>")
		for index in range(len(rows[0])):
			cell=row[index] if index<len(row) else ""
			output.append(f"<td>{inline_markup(cell)}</td>")
		output.append("</tr>")
	output.append("</tbody></table></div>")
	return "".join(output)


def render_markdown(text,heading_items=None):
	lines=text.splitlines()
	output=[]
	paragraph=[]
	list_type=None
	list_items=[]
	in_code=False
	code_language=""
	code_lines=[]

	def flush_paragraph():
		if paragraph:
			content=" ".join(item.strip() for item in paragraph)
			output.append("<p>"+inline_markup(content)+"</p>")
			paragraph.clear()

	def flush_list():
		nonlocal list_type
		if not list_items:
			list_type=None
			return
		tag="ol" if list_type=="ol" else "ul"
		output.append(f"<{tag}>"+"".join(f"<li>{item}</li>" for item in list_items)+f"</{tag}>")
		list_items.clear()
		list_type=None

	index=0
	while index<len(lines):
		line=lines[index]
		fence=re.match(r"^\s*```\s*([\w+-]*)\s*$",line)
		if fence and not in_code:
			flush_paragraph()
			flush_list()
			in_code=True
			code_language=fence.group(1).lower()
			code_lines=[]
			index+=1
			continue
		if in_code:
			if re.match(r"^\s*```\s*$",line):
				code=html.escape("\n".join(code_lines),quote=False)
				class_name="language-"+code_language if code_language else ""
				output.append(f'<pre class="code_block {code_language}"><code class="{class_name}">{code}</code></pre>')
				in_code=False
				code_language=""
			else:
				code_lines.append(line)
			index+=1
			continue
		if not line.strip():
			flush_paragraph()
			flush_list()
			index+=1
			continue
		if re.match(r"^\s*[-*_]{3,}\s*$",line):
			flush_paragraph()
			flush_list()
			output.append("<hr>")
			index+=1
			continue
		heading=re.match(r"^(#{1,6})\s+(.+?)\s*$",line)
		if heading:
			flush_paragraph()
			flush_list()
			level=len(heading.group(1))
			heading_text=heading.group(2).strip()
			heading_id=""
			if heading_items is not None and level in (2,3):
				heading_id=f"section-{len(heading_items)+1}"
				heading_items.append((level,heading_text,heading_id))
			id_attribute=f' id="{heading_id}"' if heading_id else ""
			output.append(f"<h{level}{id_attribute}>{inline_markup(heading_text)}</h{level}>")
			index+=1
			continue
		if line.startswith(">"):
			flush_paragraph()
			flush_list()
			quote_lines=[]
			while index<len(lines) and lines[index].startswith(">"):
				quote_lines.append(re.sub(r"^>\s?","",lines[index]))
				index+=1
			output.append("<blockquote>"+render_markdown("\n".join(quote_lines))+"</blockquote>")
			continue
		if "|" in line and index+1<len(lines) and re.match(r"^\s*\|?\s*:?-{3,}",lines[index+1]):
			flush_paragraph()
			flush_list()
			table_lines=[line,lines[index+1]]
			index+=2
			while index<len(lines) and "|" in lines[index] and lines[index].strip():
				table_lines.append(lines[index])
				index+=1
			output.append(render_table(table_lines))
			continue
		list_match=re.match(r"^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+)$",line)
		if list_match:
			current_type="ol" if re.match(r"^\s*\d+[.)]\s+",line) else "ul"
			flush_paragraph()
			if list_type and list_type!=current_type:
				flush_list()
			list_type=current_type
			list_items.append(inline_markup(list_match.group(1)))
			index+=1
			continue
		if list_type:
			flush_list()
		paragraph.append(line)
		index+=1
	if in_code:
		code=html.escape("\n".join(code_lines),quote=False)
		output.append(f'<pre class="code_block {code_language}"><code>{code}</code></pre>')
	flush_paragraph()
	flush_list()
	return "\n".join(output)


def summary_from(text,title):
	clean=strip_heading(text,title)
	for block in re.split(r"\n\s*\n",clean):
		value=block.strip()
		if not value or value.startswith((">","#","```","---","|","- ","* ")) or re.match(r"^\d+[.)]\s",value):
			continue
		value=re.sub(r"[`*_>#]","",value)
		value=re.sub(r"\s+"," ",value)
		return value[:150]+("..." if len(value)>150 else "")
	return "完整实验记录与原理分析。"


def prerequisite_from(text):
	for line in text.splitlines():
		if "前置知识" not in line:
			continue
		match=re.search(r"前置知识\**\s*[:：]\s*(.+)$",line)
		if not match:
			continue
		value=match.group(1).strip()
		value=re.sub(r"\s*\|.*$","",value).strip()
		value=re.sub(r"^[*_\s]+|[*_\s]+$","",value)
		return value
	return ""


def clean_metadata_lines(text):
	metadata_markers=("作者", "分类", "标签", "阅读时间", "前置知识")
	lines=[]
	for line in text.splitlines():
		if line.startswith(">") and any(marker in line for marker in metadata_markers):
			continue
		lines.append(line)
	return "\n".join(lines)


def word_count(text):
	return len(re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9_]+",text))


def article_template(article,body_html,toc_html):
	canonical=site_base+article["slug"]+".html"
	schema=json.dumps({
		"@context":"https://schema.org",
		"@type":"TechArticle",
		"headline":article["title"],
		"description":article["summary"],
		"datePublished":article["date"],
		"author":{"@type":"Person","name":"Rray"},
		"mainEntityOfPage":canonical
	},ensure_ascii=False).replace("<","\\u003c").replace(">","\\u003e").replace("&","\\u0026")
	prerequisite=article.get("prerequisite","")
	prerequisite_html=(f'<aside class="article_prerequisite"><span>前置知识</span><p>{inline_markup(prerequisite)}</p></aside>' if prerequisite else "")
	return f'''<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="{html.escape(article["summary"],quote=True)}">
	<meta property="og:type" content="article">
	<meta property="og:title" content="{html.escape(article["title"],quote=True)}">
	<meta property="og:description" content="{html.escape(article["summary"],quote=True)}">
	<meta property="og:url" content="{canonical}">
	<link rel="canonical" href="{canonical}">
	<link rel="alternate" type="application/rss+xml" title="Rray 博客 RSS" href="../rss.xml">
	<title>{html.escape(article["title"])} | Rray</title>
	<link rel="stylesheet" href="../../assets/css/style.css">
	<script type="application/ld+json">{schema}</script>
	<script src="https://unpkg.com/lucide@0.468.0"></script>
	<script>
		(function(){{if(localStorage.getItem('v2-theme')==='light')document.documentElement.classList.add('light');}})();
	</script>
</head>
<body>
	<header class="site_header"><a class="brand" href="../../index.html"><span class="brand_mark">R/</span><span>Rray<span class="brand_cursor">_</span></span></a><nav class="site_nav" aria-label="主导航"><a href="../../index.html">首页</a><a href="../../projects/index.html">项目</a><a class="active" href="../index.html">博客</a><a href="../../about.html">关于我</a></nav><div class="header_actions"><button class="menu_button" id="menuToggle" type="button" aria-label="打开菜单" aria-expanded="false">菜单</button><button class="icon_button" id="themeToggle" type="button" aria-label="切换主题"><i data-lucide="sun"></i></button></div></header>
	<nav class="mobile_nav" id="mobileNav" aria-label="移动端主导航"><a href="../../index.html">首页</a><a href="../../projects/index.html">项目</a><a class="active" href="../index.html">博客</a><a href="../../about.html">关于我</a></nav>
	<div class="reading_progress" aria-hidden="true"><span id="readingProgress"></span></div>
	<main class="article_shell"><article class="article_page"><header class="article_header"><nav class="article_pager" id="articlePager" data-current="{article["slug"]}" aria-label="文章导航"><div class="article_pager_side"><a class="article_pager_button" id="prevArticle" href="#" aria-label="上一篇" title="上一篇"><i data-lucide="arrow-left"></i></a><span><small class="article_pager_label">上一篇</small><strong class="article_pager_title">加载中</strong></span></div><div class="article_pager_side article_pager_side_next"><span><small class="article_pager_label">下一篇</small><strong class="article_pager_title">加载中</strong></span><a class="article_pager_button" id="nextArticle" href="#" aria-label="下一篇" title="下一篇"><i data-lucide="arrow-right"></i></a></div></nav><div class="article_meta"><span class="status_badge">CSDN 已发布</span><span>作者：Rray</span><span>{html.escape(article["category"])}</span><span>发布日期：{html.escape(article["date"])}</span><span>{article["word_count"]} 字 · {article["reading_time"]} 分钟</span></div><h1>{html.escape(article["title"])}</h1>{prerequisite_html}<p class="article_lead">{html.escape(article["summary"])}</p><a class="source_link" href="{article["csdn_url"]}" target="_blank" rel="noopener">查看 CSDN 原文 ↗</a></header><div class="article_layout"><aside class="article_toc" aria-label="文章目录"><span class="article_toc_label">文章目录</span>{toc_html}</aside><div class="article_body">{body_html}</div></div></article></main>
	<footer class="site_footer"><span>© 2026 Rray</span><span class="footer_rule"></span><span class="site_stats" aria-label="访问统计">站点访问 <strong id="busuanzi_value_site_pv">--</strong> · 本篇浏览 <strong id="busuanzi_value_page_pv">--</strong></span><a href="../index.html">返回博客列表</a></footer>
	<script src="../../assets/js/article-data.js"></script><script src="../../assets/js/main.js"></script><script async src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>
</body>
</html>'''


def write_feed_files(articles):
	site_root="https://rrrayy.github.io/"
	feed_items=[]
	for article in articles:
		url=site_root+"blog/posts/"+article["slug"]+".html"
		feed_items.append("\n".join([
			"\t\t<item>",
			f"\t\t\t<title>{html.escape(article['title'])}</title>",
			f"\t\t\t<link>{url}</link>",
			f"\t\t\t<guid>{url}</guid>",
			f"\t\t\t<pubDate>{html.escape(article['date'])}</pubDate>",
			f"\t\t\t<description>{html.escape(article['summary'])}</description>",
			"\t\t</item>"
		]))
	feed="""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Rray | Systems Notes</title>
		<link>https://rrrayy.github.io/blog/</link>
		<description>Rray 的 C++、系统编程与后端工程实践。</description>
		<language>zh-CN</language>
"""+"\n".join(feed_items)+"\n\t</channel>\n</rss>\n"
	(root_dir/"rss.xml").write_text(feed,encoding="utf-8")
	static_pages=["index.html","about.html","projects/index.html","blog/index.html"]
	project_pages=["projects/"+path.name for path in (root_dir.parent/"projects").glob("*.html") if path.name!="index.html"]
	urls=[site_root+page for page in static_pages+project_pages]
	urls.extend(site_root+"blog/posts/"+article["slug"]+".html" for article in articles)
	sitemap="<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
	sitemap+="".join(f"\t<url><loc>{url}</loc></url>\n" for url in urls)
	sitemap+="</urlset>\n"
	(root_dir.parent/"sitemap.xml").write_text(sitemap,encoding="utf-8")
	(root_dir.parent/"robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: https://rrrayy.github.io/sitemap.xml\n",encoding="utf-8")


def build():
	posts_dir.mkdir(parents=True,exist_ok=True)
	asset_dir.mkdir(parents=True,exist_ok=True)
	image_source=content_dir/"images"
	if image_source.exists():
		for image in image_source.iterdir():
			if image.is_file():
				shutil.copy2(image,asset_dir/image.name)
	articles=[]
	for source_path in sorted(content_dir.rglob("*.md")):
		relative=source_path.relative_to(content_dir).as_posix()
		if relative.startswith("images/"):
			continue
		raw_text=source_path.read_text(encoding="utf-8")
		metadata,body=parse_front_matter(raw_text)
		title=metadata.get("title") or first_heading(body)
		body=strip_heading(body,title)
		if relative not in published_meta:
			continue
		prerequisite=prerequisite_from(body)
		body=clean_metadata_lines(body)
		date,csdn_url=published_meta[relative]
		category=category_names.get(relative.split("/",1)[0],metadata.get("categories","技术记录"))
		count=word_count(body)
		article={"title":title,"date":date,"category":category,"csdn_url":csdn_url,"slug":slug_map[relative],"word_count":count,"reading_time":max(1,round(count/450)),"summary":summary_from(body,title),"prerequisite":prerequisite,"source_path":relative}
		articles.append(article)
		heading_items=[]
		body_html=render_markdown(body,heading_items)
		toc_html="".join(f'<a class="toc_level_{level}" href="#{heading_id}">{html.escape(title)}</a>' for level,title,heading_id in heading_items)
		(posts_dir/(article["slug"]+".html")).write_text(article_template(article,body_html,toc_html),encoding="utf-8")
	articles.sort(key=lambda item:item["date"],reverse=True)
	(posts_dir/"index.json").write_text(json.dumps(articles,ensure_ascii=False,indent=2),encoding="utf-8")
	write_feed_files(articles)
	print(f"built {len(articles)} published articles")


if __name__=="__main__":
	build()
