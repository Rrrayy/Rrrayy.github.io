// ===== 留言板（Supabase 云端 + localStorage 兜底） =====
(function(){
	// ★ 启用云端留言：前往 https://supabase.com 创建免费项目
	//   执行下方 SQL 建表，然后替换 URL 和 Key
	/* 建表 SQL（在 Supabase SQL Editor 执行）：
	   CREATE TABLE guestbook (
	     id BIGSERIAL PRIMARY KEY,
	     name TEXT DEFAULT '',
	     text TEXT NOT NULL,
	     parent_id BIGINT DEFAULT NULL,
	     created_at TIMESTAMPTZ DEFAULT NOW()
	   );
	   ALTER TABLE guestbook ENABLE ROW LEVEL SECURITY;
	   CREATE POLICY "anon_read" ON guestbook FOR SELECT USING (true);
	   CREATE POLICY "anon_insert" ON guestbook FOR INSERT WITH CHECK (true);
	*/
	var SUPABASE_URL='https://leoemzernexgpsngortl.supabase.co';
	var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb2VtemVybmV4Z3BzbmdvcnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDk5NDQsImV4cCI6MjA5NjgyNTk0NH0.GnmozyaMQTYl_5UKhK2PW5iwvHFO8OQ3ya7nGio0jB0';
	var ADMIN_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxlb2VtemVybmV4Z3BzbmdvcnRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0OTk0NCwiZXhwIjoyMDk2ODI1OTQ0fQ.7RY7YsflJNWY_q3GKmi3NXvKqrStdUO2S1gC2Jdgie4'; // ★ 填入 Supabase service_role key
	var ADMIN_PASS='cfr20060419'; // ★ 改成你自己的管理密码
	var isAdmin=false,showAll=false,allMsgs=[],TABLE='guestbook',STORAGE_KEY='gb_messages';
	var useCloud=!!(SUPABASE_URL&&SUPABASE_KEY&&SUPABASE_URL.indexOf('your-project')===-1);

	// DOM 元素（可能部分在独立页不存在）
	var overlay=document.getElementById('guestbookOverlay');
	var trigger=document.getElementById('guestbookTrigger');
	var closeBtn=document.getElementById('guestbookClose');
	var form=document.getElementById('guestbookForm');
	var list=document.getElementById('gbList');
	var footer=document.getElementById('gbFooter');
	var nameInp=document.getElementById('gbName');
	var msgInp=document.getElementById('gbMsg');
	var submitBtn=document.getElementById('gbSubmitBtn');
	var adminLock=document.getElementById('adminLock');

	// 判断是否为弹窗模式（有 overlay 和 trigger 才算）
	var isModal=!!(overlay&&trigger);

	if(footer)footer.innerHTML=useCloud?'📡 云端同步 · 所有人可见':'📌 离线模式 · 留言仅保存在本地浏览器';

	// ===== 工具函数 =====
	function timeAgo(ts){
		var diff=Date.now()-ts;
		if(diff<60000)return '刚刚';
		if(diff<3600000)return Math.floor(diff/60000)+'分钟前';
		if(diff<86400000)return Math.floor(diff/3600000)+'小时前';
		if(diff<2592000000)return Math.floor(diff/86400000)+'天前';
		return new Date(ts).toLocaleDateString('zh-CN');
	}
	function escHTML(s){
		return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
	}
	function loadLocal(){
		try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}
		catch(e){return[];}
	}
	function saveLocal(msgs){
		if(msgs.length>50)msgs=msgs.slice(0,50);
		localStorage.setItem(STORAGE_KEY,JSON.stringify(msgs));
	}
	function loadCloud(callback){
		if(!list)return callback([]);
		list.innerHTML='<div style="text-align:center;padding:24px 0;color:var(--c-text-dim);font-size:0.72rem;">加载中...</div>';
		fetch(SUPABASE_URL+'/rest/v1/'+TABLE+'?select=*&order=created_at.asc&limit=200',{
			headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY}
		})
		.then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
		.then(function(data){callback(data);})
		.catch(function(){callback(loadLocal());});
	}
	function saveCloud(msg,callback){
		var body={name:msg.name,text:msg.text,created_at:new Date().toISOString()};
		if(msg.parent_id)body.parent_id=msg.parent_id;
		fetch(SUPABASE_URL+'/rest/v1/'+TABLE,{
			method:'POST',
			headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Content-Type':'application/json','Prefer':'return=representation'},
			body:JSON.stringify(body)
		})
		.then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
		.then(function(data){callback(null,data);})
		.catch(function(err){var msgs=loadLocal();msgs.unshift(msg);saveLocal(msgs);callback(err,loadLocal());});
	}
	function deleteMsg(id){
		if(!ADMIN_KEY){alert('未配置 ADMIN_KEY（service_role key），请先在代码中填入');return;}
		if(!confirm('确定删除这条留言？'))return;
		fetch(SUPABASE_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(id),{
			method:'DELETE',
			headers:{'apikey':ADMIN_KEY,'Authorization':'Bearer '+ADMIN_KEY}
		})
		.then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);loadAndRender();})
		.catch(function(err){alert('删除失败: '+err.message);});
	}
	function buildTree(msgs){
		var map={},roots=[];
		msgs.forEach(function(m){m.replies=[];map[m.id]=m;});
		msgs.forEach(function(m){
			if(m.parent_id&&map[m.parent_id]){map[m.parent_id].replies.push(m);}
			else if(!m.parent_id){roots.push(m);}
		});
		roots.sort(function(a,b){return new Date(b.created_at)-new Date(a.created_at);});
		roots.forEach(function(r){r.replies.sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});});
		return roots;
	}
	function renderMsg(m,depth){
		var name=m.name||'匿名';
		var ts=m.created_at?new Date(m.created_at).getTime():m.time;
		var ml=depth*28;
		var html='<div class="gb_msg_item" style="'+(depth?'border-left:1px solid var(--c-border);padding-left:12px;margin-left:'+ml+'px;':'')+'">';
		html+='<div class="gb_meta"><span class="gb_name">'+escHTML(name)+'</span><span class="gb_time">'+timeAgo(ts)+'</span>';
		if(isAdmin&&m.id)html+=' <span data-del="'+m.id+'" style="cursor:pointer;color:#ef4444;font-size:0.65rem;opacity:0.6;" title="删除">✕</span>';
		html+=' <span class="gb_reply_btn" data-reply="'+(m.id||'')+'" style="cursor:pointer;color:var(--c-text-muted);font-size:0.65rem;opacity:0.5;" title="回复">↩ 回复</span>';
		html+='</div><div class="gb_text">'+escHTML(m.text)+'</div>';
		html+='<div class="gb_reply_form" id="replyForm_'+m.id+'" style="display:none;margin:6px 0 4px;"></div>';
		if(m.replies&&m.replies.length)m.replies.forEach(function(r){html+=renderMsg(r,depth+1);});
		html+='</div>';
		return html;
	}
	function showReplyForm(parentId){
		if(!list)return;
		list.querySelectorAll('.gb_reply_form').forEach(function(f){f.style.display='none';f.innerHTML='';});
		var c=document.getElementById('replyForm_'+parentId);
		if(!c)return;
		c.style.display='block';
		c.innerHTML='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
			+'<input type="text" class="reply_name" placeholder="昵称" maxlength="20" style="flex:1;min-width:60px;padding:4px 8px;font-size:0.7rem;border:1px solid var(--c-border);border-radius:6px;background:transparent;color:var(--c-text);outline:none;font-family:inherit;">'
			+'<input type="text" class="reply_msg" placeholder="写回复..." maxlength="500" style="flex:2;min-width:100px;padding:4px 8px;font-size:0.7rem;border:1px solid var(--c-border);border-radius:6px;background:transparent;color:var(--c-text);outline:none;font-family:inherit;">'
			+'<button class="reply_submit" data-parent="'+parentId+'" style="padding:4px 14px;font-size:0.7rem;color:#fff;background:#ef4444;border:none;border-radius:9999px;cursor:pointer;font-family:inherit;">回复</button></div>';
		c.querySelector('.reply_msg').addEventListener('keydown',function(e){
			if(e.key==='Enter'){e.preventDefault();c.querySelector('.reply_submit').click();}
		});
		c.querySelector('.reply_submit').addEventListener('click',function(){
			var name=c.querySelector('.reply_name').value.trim();
			var text=c.querySelector('.reply_msg').value.trim();
			if(!text)return;
			var btn=c.querySelector('.reply_submit');
			btn.disabled=true;
			btn.textContent='...';
			var msg={name:name,text:text,parent_id:parseInt(parentId),time:Date.now()};
			if(useCloud){
				saveCloud(msg,function(){c.style.display='none';c.innerHTML='';loadAndRender();});
			}else{
				var msgs=loadLocal();msg.id=Date.now()+Math.floor(Math.random()*1000);msgs.unshift(msg);saveLocal(msgs);
				c.style.display='none';c.innerHTML='';render(msgs);
			}
		});
	}
	function render(msgs){
		allMsgs=msgs||[];
		if(!list)return;
		if(!allMsgs.length){list.innerHTML='<div style="text-align:center;padding:24px 0;color:var(--c-text-dim);font-size:0.72rem;">还没有留言，来说点什么吧 👋</div>';return;}
		var roots=buildTree(allMsgs);
		var display=showAll?roots:roots.slice(0,3);
		var html='';
		display.forEach(function(m){html+=renderMsg(m,0);});
		if(!showAll&&roots.length>3){
			html+='<div id="gbExpandBtn" style="text-align:center;padding:10px 0 4px;cursor:pointer;color:var(--c-text-muted);font-size:0.68rem;transition:color 0.2s;" onmouseover="this.style.color=\'#fca5a5\'" onmouseout="this.style.color=\'var(--c-text-muted)\'">查看全部留言 ('+roots.length+' 条) ▾</div>';
		}
		if(showAll&&roots.length>3){
			html+='<div id="gbCollapseBtn" style="text-align:center;padding:10px 0 4px;cursor:pointer;color:var(--c-text-muted);font-size:0.68rem;transition:color 0.2s;" onmouseover="this.style.color=\'#fca5a5\'" onmouseout="this.style.color=\'var(--c-text-muted)\'">收起 ▴</div>';
		}
		list.innerHTML=html;
		if(isAdmin){list.querySelectorAll('[data-del]').forEach(function(el){el.addEventListener('click',function(e){e.stopPropagation();deleteMsg(parseInt(this.getAttribute('data-del')));});});}
		list.querySelectorAll('.gb_reply_btn').forEach(function(el){el.addEventListener('click',function(e){e.stopPropagation();showReplyForm(this.getAttribute('data-reply'));});});
		var expandBtn=document.getElementById('gbExpandBtn');
		var collapseBtn=document.getElementById('gbCollapseBtn');
		if(expandBtn)expandBtn.addEventListener('click',function(){showAll=true;render(allMsgs);if(list)list.scrollTop=0;});
		if(collapseBtn)collapseBtn.addEventListener('click',function(){showAll=false;render(allMsgs);if(list)list.scrollTop=0;});
	}
	function loadAndRender(){loadCloud(function(msgs){allMsgs=msgs||[];render(allMsgs);});}
	function closeModal(){if(overlay){overlay.classList.remove('open');}if(form)form.reset();showAll=false;if(list)list.querySelectorAll('.gb_reply_form').forEach(function(f){f.style.display='none';f.innerHTML='';});}

	// ===== 初始化 =====
	// 弹窗模式：绑定 trigger 打开弹窗
	if(isModal&&trigger){
		trigger.addEventListener('click',function(){
			overlay.classList.add('open');
			loadAndRender();
			if(msgInp)setTimeout(function(){msgInp.focus();},200);
		});
		if(closeBtn)closeBtn.addEventListener('click',closeModal);
		if(overlay)overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal();});
		document.addEventListener('keydown',function(e){
			if(e.key==='Escape'&&overlay.classList.contains('open'))closeModal();
		});
	}

	// 独立页模式或弹窗已就绪：直接加载留言
	if(list&&(!isModal||overlay.classList.contains('open'))){
		loadAndRender();
	}

	// 管理员入口
	if(adminLock){
		adminLock.addEventListener('click',function(e){
			e.stopPropagation();
			if(isAdmin){isAdmin=false;adminLock.textContent='🔒';adminLock.style.opacity='0.35';loadAndRender();return;}
			var pw=prompt('管理员密码：');
			if(pw===ADMIN_PASS){isAdmin=true;adminLock.textContent='🔓';adminLock.style.opacity='0.8';loadAndRender();}
			else if(pw!==null){alert('密码错误');}
		});
	}

	// 表单提交
	if(form&&submitBtn){
		form.addEventListener('submit',function(e){
			e.preventDefault();
			var text=msgInp?msgInp.value.trim():'';
			if(!text)return;
			if(submitBtn.disabled)return;
			submitBtn.disabled=true;
			submitBtn.textContent='发送中...';
			var msg={name:nameInp?nameInp.value.trim():'',text:text,time:Date.now()};
			if(useCloud){
				saveCloud(msg,function(err,msgs){
					submitBtn.disabled=false;
					submitBtn.textContent='发送留言';
					if(form)form.reset();
					if(msgs)render(msgs);
					if(list)list.scrollTop=0;
				});
			}else{
				var msgs=loadLocal();msgs.unshift(msg);saveLocal(msgs);
				submitBtn.disabled=false;
				submitBtn.textContent='发送留言';
				if(form)form.reset();
				render(msgs);
				if(list)list.scrollTop=0;
			}
		});
	}

	// 如果是独立页（无弹窗），自动加载
	if(!isModal&&list){
		loadAndRender();
		if(msgInp)setTimeout(function(){msgInp.focus();},200);
	}
})();
