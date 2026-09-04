(function(){
	var article_list=document.getElementById('articleList');
	var search_input=document.getElementById('blogSearch');
	var search_status=document.getElementById('blogSearchStatus');
	var articles=[];
	function escape_html(value){return String(value).replace(/[&<>\"']/g,function(character){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character];});}
	function render_articles(){
		if(!article_list)return;
		var keyword=(search_input.value||'').toLowerCase().trim();
		var visible=articles.filter(function(article){
			var haystack=(article.title+' '+article.summary+' '+article.category+' '+(article.tags||[]).join(' ')).toLowerCase();
			return haystack.indexOf(keyword)>-1;
		});
		if(search_status)search_status.textContent='显示 '+visible.length+' / '+articles.length+' 篇';
		if(!visible.length){article_list.innerHTML='<p class="article_empty">没有匹配的已发布文章。</p>';return;}
		article_list.innerHTML=visible.map(function(article){var tags=(article.tags||[]).slice(0,3).map(function(tag){return '<span>'+escape_html(tag)+'</span>';}).join('');return '<a class="article_row" href="posts/'+encodeURIComponent(article.slug)+'.html"><div class="article_date">'+escape_html(article.date.slice(0,10).replace(/-/g,'.'))+'</div><div class="article_main"><div class="article_label">'+escape_html(article.category)+'</div><h2>'+escape_html(article.title)+'</h2><p>'+escape_html(article.summary)+'</p><div class="article_row_tags">'+tags+'</div><div class="article_time">'+article.reading_time+' 分钟阅读</div></div></a>';}).join('');
		if(window.lucide)lucide.createIcons();
	}
	if(search_input)search_input.addEventListener('input',render_articles);
	document.addEventListener('keydown',function(event){
		var target=event.target;
		var is_typing=target&&(['INPUT','TEXTAREA','SELECT'].indexOf(target.tagName)>-1||target.isContentEditable);
		if((event.key==='/'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'))&&!is_typing){
			event.preventDefault();
			if(search_input){search_input.focus();search_input.select();}
		}
	});
	articles=window.blog_articles||[];
	var post_count=document.getElementById('blogPostCount');
	var category_count=document.getElementById('blogCategoryCount');
	var tag_count=document.getElementById('blogTagCount');
	if(post_count)post_count.textContent=articles.length;
	if(category_count)category_count.textContent=new Set(articles.map(function(article){return article.category;})).size;
	if(tag_count)tag_count.textContent=new Set(articles.reduce(function(all,article){return all.concat(article.tags||[]);},[])).size;
	render_articles();
})();
