		lucide.createIcons();
		// 鼠标聚光灯
		(function(){
			var el=document.getElementById('spotlight');
			if(!el)return;
			document.addEventListener('mousemove',function(e){
				var x=(e.clientX/window.innerWidth)*100,y=(e.clientY/window.innerHeight)*100;
				el.style.setProperty('--s-x',x+'%');
				el.style.setProperty('--s-y',y+'%');
			});
		})();
		// CTA 滚动到技术栈
		(function(){
			var btn=document.getElementById('ctaBtn'),tech=document.getElementById('techstack');
			if(!btn||!tech)return;
			btn.addEventListener('click',function(){tech.scrollIntoView({behavior:'smooth',block:'start'});});
		})();
		// 右面板滚动进度条
		(function(){
			var bar=document.getElementById('scrollProgress'),rp=document.getElementById('rightPane');
			if(!bar||!rp)return;
			rp.addEventListener('scroll',function(){
				var st=rp.scrollTop,dh=rp.scrollHeight-rp.clientHeight;
				if(dh>0)bar.style.width=((st/dh)*100)+'%';
			});
		})();
		// 渐入动画
		(function(){
			var els=document.querySelectorAll('.reveal');
			if(!els.length)return;
			var obs=new IntersectionObserver(function(entries){
				entries.forEach(function(e){
					if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target);}
				});
			},{threshold:0.08,rootMargin:'0px 0px -30px 0px'});
			els.forEach(function(el){obs.observe(el);});
		})();
		// 主题切换
		(function(){
			var btn=document.getElementById('themeToggle')||document.getElementById('themeToggleNav');
			if(!btn)return;
			btn.addEventListener('click',function(){
				var html=document.documentElement;
				var isLight=html.classList.toggle('light');
				localStorage.setItem('theme',isLight?'light':'dark');
			});
		})();
	




// ===== 卡片 tilt 微动效 =====
(function(){
	var cards=document.querySelectorAll('.tilt_card');
	cards.forEach(function(card){
		card.addEventListener('mousemove',function(e){
			var rect=card.getBoundingClientRect();
			var x=e.clientX-rect.left,y=e.clientY-rect.top;
			var cx=rect.width/2,cy=rect.height/2;
			var rotX=(y-cy)/cy*-6,rotY=(x-cx)/cx*6;
			card.style.transform='perspective(800px) rotateX('+rotX+'deg) rotateY('+rotY+'deg)';
		});
		card.addEventListener('mouseleave',function(){
			card.style.transform='perspective(800px) rotateX(0deg) rotateY(0deg)';
		});
	});
})();
// ===== 导航栏：高亮当前页 + 汉堡菜单 =====
(function(){
	var links=document.querySelectorAll('.nav_link');
	var path=window.location.pathname.split('/').pop()||'index.html';
	links.forEach(function(el){
		var href=el.getAttribute('href');
		if(href===path)el.classList.add('active');
	});
	// 汉堡菜单
	var hamburger=document.getElementById('navHamburger');
	var navLinks=document.getElementById('navLinks');
	if(hamburger&&navLinks){
		hamburger.addEventListener('click',function(){
			navLinks.classList.toggle('open');
		});
		document.addEventListener('click',function(e){
			if(!hamburger.contains(e.target)&&!navLinks.contains(e.target)){
				navLinks.classList.remove('open');
			}
		});
	}
})();
