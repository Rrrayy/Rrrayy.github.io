# coding: utf-8
"""构建脚本：扫描 MD → 生成静态 HTML 文章页 + index.json"""
import os, json, re, glob, markdown

BASE = os.path.dirname(os.path.abspath(__file__))
POSTS_DIR = os.path.join(BASE, 'blog', 'posts')

PAGE_TPL = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>{title} · Rray</title>
	<meta name="description" content="{excerpt}">
	<script src="https://cdn.tailwindcss.com"></script>
	<script src="https://unpkg.com/lucide@0.294.0"></script>
	<link rel="stylesheet" href="../../assets/css/style.css">
	<script>(function(){{var t=localStorage.getItem('theme');if(t==='light'||(!t&&window.matchMedia('(prefers-color-scheme:light)').matches)){{document.documentElement.classList.add('light');}}}})();</script>
</head>
<body>
	<a href="javascript:history.back()" onclick="if(!document.referrer){{this.href='../../index.html';}}" style="position:fixed;top:20px;left:20px;z-index:100;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all 0.3s ease;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" onmouseover="this.style.color='#fca5a5';this.style.borderColor='rgba(239,68,68,0.35)';this.style.background='rgba(239,68,68,0.08)';" onmouseout="this.style.color='rgba(255,255,255,0.6)';this.style.borderColor='rgba(255,255,255,0.12)';this.style.background='rgba(255,255,255,0.04)';" aria-label="返回" title="返回"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg></a>
	<div class="bg_base" aria-hidden="true"></div>
	<div class="aurora_orbs" aria-hidden="true"><div class="aurora_orb"></div><div class="aurora_orb"></div></div>
	<div class="bg_grid" aria-hidden="true"></div>
	<div class="noise_overlay" aria-hidden="true"></div>
	<div id="spotlight" aria-hidden="true"></div>

	<nav class="site_nav">
		<div class="nav_inner">
			<a class="nav_logo" href="../../index.html">Rray</a>
			<button class="nav_hamburger" id="navHamburger" aria-label="菜单"><i data-lucide="menu"></i></button>
			<div class="nav_links" id="navLinks">
				<a href="../../index.html" class="nav_link">首页</a>
				<a href="../../roadmap.html" class="nav_link">学习路线</a>
				<a href="../../bookshelf.html" class="nav_link">书架</a>
				<a href="../index.html" class="nav_link">博客</a>
				<a href="../../guestbook.html" class="nav_link">留言板</a>
			</div>
			<button id="themeToggleNav" class="theme_toggle_btn" style="position:static;width:32px;height:32px;" aria-label="切换主题">
				<span id="icon_sun"><i data-lucide="sun"></i></span>
				<span id="icon_moon"><i data-lucide="moon"></i></span>
			</button>
		</div>
	</nav>

	<main class="page_content" style="padding-top:24px;">
		<article style="max-width:720px;margin:0 auto;">
			<header style="margin-bottom:32px;">
				<h1 style="font-size:1.5rem;color:var(--c-text-heading);font-weight:700;line-height:1.35;margin-bottom:8px;">{title}</h1>
				<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.72rem;color:var(--c-text-muted);margin-bottom:8px;">
					<span>{date}</span>
					<span>{tags_html}</span>
				</div>
				<div style="font-size:0.68rem;color:var(--c-text-dim);">约 {word_count} 字 · 阅读 {reading_time} 分钟</div>
			</header>
			<div class="post_body keep_markdown_body">
{body_html}
			</div>
		</article>
	</main>

	<!-- 更新日志 -->
	<div class="cl_mini" id="clMini" style="margin-top:32px;max-width:720px;margin-left:auto;margin-right:auto;">
		<div class="cl_mini_title">📋 更新日志</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/16</span>算法仓库改为持续进行中状态</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/15</span>作品集完成状态 · 智能指针库</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/14</span>书架放大弹窗 · 二刷状态</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/12</span>留言板回复功能</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/10</span>学习路线 · 算法仓库</div>
		<div class="cl_mini_entry"><span class="cl_mini_date">06/09</span>网站 v2 上线</div>
	</div>

	<!-- ========== 更新日志弹窗 ========== -->
	<div class="cl_overlay" id="clOverlay">
		<div class="cl_modal">
			<div class="cl_modal_head">
				<span class="cl_modal_title">📋 更新日志</span>
				<button class="cl_modal_close" id="clCloseBtn">✕</button>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-16</div>
				<div class="cl_block_item"><span class="cl_block_tag upd">修改</span>Algorithm-Problems 算法仓库状态改为「持续进行中」</div>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-15</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>作品完成状态功能 — 已完成/开发中徽章区分</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>智能指针库（cpp-smart-ptr）</div>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-14</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>书架点击放大弹窗</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>二刷状态（琥珀色）</div>
				<div class="cl_block_item"><span class="cl_block_tag upd">修改</span>三本书改为「在读」</div>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-12</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>留言板回复功能</div>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-10</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>学习路线模块 — 四阶段时间线</div>
				<div class="cl_block_item"><span class="cl_block_tag new">新增</span>作品集添加算法仓库</div>
			</div>
			<div class="cl_block">
				<div class="cl_block_date">2026-06-09</div>
				<div class="cl_block_item"><span class="cl_block_tag new">上线</span>Rray 个人网站 v2</div>
			</div>
		</div>
	</div>

	<script>
		(function(){
			var mini=document.getElementById('clMini');
			var overlay=document.getElementById('clOverlay');
			var closeBtn=document.getElementById('clCloseBtn');
			if(!mini||!overlay||!closeBtn)return;
			mini.addEventListener('click',function(){overlay.classList.add('open');});
			closeBtn.addEventListener('click',function(){overlay.classList.remove('open');});
			overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.classList.remove('open');});
			document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay.classList.contains('open'))overlay.classList.remove('open');});
		}})();
	</script>
</body>
</html>'''

def slugify(title):
    tokens = []
    pinyin_map = {
        '第':'di','一':'yi','个':'ge','博':'bo','客':'ke','文':'wen','章':'zhang',
        '杂':'za','谈':'tan','开':'kai','始':'shi','日':'ri','常':'chang',
        '智':'zhi','能':'neng','指':'zhi','针':'zhen','的':'de','问':'wen','题':'ti',
        '关':'guan','于':'yu','学':'xue','习':'xi','路':'lu','线':'xian',
        '计':'ji','算':'suan','机':'ji','系':'xi','统':'tong','笔':'bi','记':'ji',
        'C':'c','+':'plus',
    }
    for ch in title.lower().strip():
        if ch in pinyin_map:
            tokens.append(pinyin_map[ch])
        elif '一' <= ch <= '鿿':
            tokens.append(ch)
        elif ch.isalnum():
            tokens.append(ch)
    slug = '-'.join(tokens)
    slug = re.sub(r'-plus-', '-plus', slug)
    slug = re.sub(r'-+', '-', slug).strip('-')
    return slug or 'post'

def parse_frontmatter(text):
    meta = {'title':'','date':'','tags':[],'categories':[]}
    if not text.startswith('---'):
        return meta, text
    end = text.find('---', 3)
    if end < 0:
        return meta, text
    fm = text[3:end].strip()
    body = text[end+3:].strip()
    for line in fm.split('\n'):
        m = re.match(r'(\w+):\s*(.+)', line)
        if m:
            k, v = m.group(1), m.group(2).strip()
            if k == 'tags':
                meta['tags'] = [t.strip().strip('"\'') for t in v.split(',')]
            elif k == 'categories':
                meta['categories'] = [t.strip().strip('"\'') for t in v.split(',')]
            elif k == 'title':
                meta['title'] = v.strip('"\'')
            elif k == 'date':
                meta['date'] = v.strip('"\'')
    return meta, body

def main():
    md_files = sorted(glob.glob(os.path.join(POSTS_DIR, '*.md')), reverse=True)
    posts = []
    os.makedirs(POSTS_DIR, exist_ok=True)

    for fpath in md_files:
        fname = os.path.basename(fpath)
        with open(fpath, 'r', encoding='utf-8') as f:
            text = f.read()
        meta, body = parse_frontmatter(text)
        slug = slugify(meta['title']) if meta['title'] else fname[:-3]
        meta['slug'] = slug

        body_html = markdown.markdown(body, extensions=['fenced_code','codehilite','tables'])
        excerpt = re.sub(r'<[^>]+>', '', body_html).strip()[:150]
        wc = len(re.sub(r'\s', '', body))
        rt = max(1, round(wc/500))
        tags_html = ''.join(
            '<span style="color:var(--c-tag-text);background:var(--c-tag-bg);padding:1px 8px;border-radius:99px;font-size:0.65rem;">'+t+'</span>'
            for t in meta.get('tags',[])
        )

        page = PAGE_TPL.format(
            title=meta['title'], date=meta.get('date',''),
            tags_html=tags_html, body_html=body_html,
            excerpt=excerpt.replace('"','&quot;'),
            word_count=wc, reading_time=rt,
        )

        out = os.path.join(POSTS_DIR, slug+'.html')
        with open(out, 'w', encoding='utf-8') as f:
            f.write(page)
        meta['url'] = 'posts/'+slug+'.html'
        posts.append(meta)
        print(f'  {slug}.html')

    with open(os.path.join(POSTS_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'posts': posts}, f, ensure_ascii=False, indent=2)
    print(f'\n-> {len(posts)} 篇已生成')

if __name__ == '__main__':
    main()
