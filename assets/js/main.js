(function(){
	function escape_html(value){
		return String(value).replace(/[&<>\"']/g,function(character){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[character];});
	}
	function set_theme(){
		var button=document.getElementById('themeToggle');
		if(!button)return;
		button.addEventListener('click',function(){
			document.documentElement.classList.toggle('light');
			localStorage.setItem('v2-theme',document.documentElement.classList.contains('light')?'light':'dark');
		});
	}
	function set_mobile_menu(){
		var button=document.getElementById('menuToggle');
		var menu=document.getElementById('mobileNav');
		if(!button||!menu)return;
		button.addEventListener('click',function(){
			var open=menu.classList.toggle('open');
			button.setAttribute('aria-expanded',open?'true':'false');
		});
		menu.querySelectorAll('a').forEach(function(link){link.addEventListener('click',function(){menu.classList.remove('open');button.setAttribute('aria-expanded','false');});});
	}
	function render_latest_articles(){
		var list=document.getElementById('homeWritingList');
		if(!list)return;
		var articles=window.blog_articles||[];
		list.innerHTML=articles.slice(0,5).map(function(article){
			return '<a class="writing_item" href="blog/posts/'+encodeURIComponent(article.slug)+'.html"><span>'+escape_html(article.date)+'</span><strong>'+escape_html(article.title)+'</strong><em>'+escape_html(article.category)+' · CSDN 已发布</em><i data-lucide="arrow-up-right"></i></a>';
		}).join('');
		if(window.lucide)lucide.createIcons();
	}
	function set_article_pager(){
		var pager=document.getElementById('articlePager');
		if(!pager)return;
		var articles=window.blog_articles||[];
		var current=pager.getAttribute('data-current');
		var current_index=articles.findIndex(function(article){return article.slug===current;});
		var previous=document.getElementById('prevArticle');
		var next=document.getElementById('nextArticle');
		function set_link(link,article,label){
			if(!link)return;
			var side=link.parentElement;
			if(!article){if(side)side.classList.add('is-hidden');return;}
			if(side)side.classList.remove('is-hidden');
			link.href=article.slug+'.html';
			link.setAttribute('aria-label',label+'：'+article.title);
			var title=side?side.querySelector('.article_pager_title'):null;
			if(title)title.textContent=article.title;
		}
		if(current_index<0){set_link(previous,null,'上一篇');set_link(next,null,'下一篇');return;}
		set_link(previous,articles[current_index+1],'上一篇');
		set_link(next,articles[current_index-1],'下一篇');
	}
	function set_log_modal(){
		var open_button=document.getElementById('openLog');
		var close_button=document.getElementById('closeLog');
		var overlay=document.getElementById('logOverlay');
		if(!open_button||!close_button||!overlay)return;
		function close_log(){overlay.hidden=true;document.body.style.overflow='';}
		open_button.addEventListener('click',function(){overlay.hidden=false;document.body.style.overflow='hidden';close_button.focus();});
		close_button.addEventListener('click',close_log);
		overlay.addEventListener('click',function(event){if(event.target===overlay)close_log();});
		document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!overlay.hidden)close_log();});
	}
	function set_reading_progress(){
		var progress=document.getElementById('readingProgress');
		if(!progress)return;
		function update_progress(){
			var scrollable_height=document.documentElement.scrollHeight-window.innerHeight;
			var ratio=scrollable_height>0?window.scrollY/scrollable_height:0;
			progress.style.width=Math.min(100,Math.max(0,ratio*100))+'%';
		}
		window.addEventListener('scroll',update_progress,{passive:true});
		window.addEventListener('resize',update_progress);
		update_progress();
	}
	function copy_text(value){
		if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(value);
		return new Promise(function(resolve,reject){
			var textarea=document.createElement('textarea');
			textarea.value=value;
			textarea.style.position='fixed';
			textarea.style.opacity='0';
			document.body.appendChild(textarea);
			textarea.select();
			try{document.execCommand('copy');resolve();}catch(error){reject(error);}finally{textarea.remove();}
		});
	}
	function enhance_code_blocks(){
		document.querySelectorAll('.article_body pre.code_block').forEach(function(block){
			var wrapper=document.createElement('div');
			wrapper.className='code_block_wrap';
			block.parentNode.insertBefore(wrapper,block);
			wrapper.appendChild(block);
			var button=document.createElement('button');
			button.className='code_copy_button';
			button.type='button';
			button.title='复制代码';
			button.setAttribute('aria-label','复制代码');
			button.innerHTML='<i data-lucide="copy"></i>';
			button.addEventListener('click',function(){
				copy_text(block.innerText).then(function(){
					button.classList.add('copied');
					button.title='已复制';
					window.setTimeout(function(){button.classList.remove('copied');button.title='复制代码';},1400);
				});
			});
			wrapper.appendChild(button);
		});
		if(window.lucide)lucide.createIcons();
	}
	set_theme();
	set_mobile_menu();
	if(window.lucide)lucide.createIcons();
	render_latest_articles();
	set_article_pager();
	set_log_modal();
	set_reading_progress();
	enhance_code_blocks();
})();
