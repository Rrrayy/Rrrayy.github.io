(function(){
	var article_list=document.getElementById('articleList');
	var search_input=document.getElementById('blogSearch');
	var search_status=document.getElementById('blogSearchStatus');
	var active_category='all';
	var articles=[];
	function escape_html(value){return String(value).replace(/[&<>\"']/g,function(character){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character];});}
	function render_articles(){
		if(!article_list)return;
		var keyword=(search_input.value||'').toLowerCase().trim();
		var visible=articles.filter(function(article){
			var matches_category=active_category==='all'||article.category===active_category;
			var haystack=(article.title+' '+article.summary+' '+article.category).toLowerCase();
			return matches_category&&haystack.indexOf(keyword)>-1;
		});
		if(search_status)search_status.textContent='显示 '+visible.length+' / '+articles.length+' 篇';
		if(!visible.length){article_list.innerHTML='<p class="article_empty">没有匹配的已发布文章。</p>';return;}
		article_list.innerHTML=visible.map(function(article){return '<a class="article_row" href="posts/'+encodeURIComponent(article.slug)+'.html"><div class="article_date">'+escape_html(article.date)+'</div><div class="article_main"><div class="article_label">'+escape_html(article.category)+' · CSDN 已发布</div><h2>'+escape_html(article.title)+'</h2><p>'+escape_html(article.summary)+'</p></div><div class="article_time">'+article.reading_time+' 分钟 <i data-lucide="arrow-up-right"></i></div></a>';}).join('');
		if(window.lucide)lucide.createIcons();
	}
	document.querySelectorAll('[data-category]').forEach(function(button){button.addEventListener('click',function(){active_category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(function(item){item.classList.toggle('active',item===button);});render_articles();});});
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
	render_articles();
})();
