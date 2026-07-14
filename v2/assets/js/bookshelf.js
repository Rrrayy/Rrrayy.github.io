			// ===== 书架点击放大 =====
			(function(){
				var overlay=document.getElementById("bookOverlay");
				var closeBtn=document.getElementById("bookCloseBtn");
				var titleEl=document.getElementById("bookModalTitle");
				var authorEl=document.getElementById("bookModalAuthor");
				var noteEl=document.getElementById("bookModalNote");
				var statusEl=document.getElementById("bookModalStatus");
				document.querySelectorAll(".book_card_item").forEach(function(el){
					el.addEventListener("click",function(){
						var t=this.querySelector(".bc_title");
						var a=this.querySelector(".bc_author");
						var n=this.querySelector(".bc_note");
						var s=this.querySelector(".bc_status");
						titleEl.textContent=t?t.textContent:"";
						authorEl.textContent=a?a.textContent:"";
						noteEl.textContent=n?n.textContent:"";
						var label=s?s.textContent.replace(/[●·•]/g,"").trim():"";
						statusEl.innerHTML='<span class="bc_dot"></span>'+label;
						statusEl.className="book_modal_status";
						if(this.classList.contains("status_reading"))statusEl.classList.add("status_reading");
						else if(this.classList.contains("status_done"))statusEl.classList.add("status_done");
						else if(this.classList.contains("status_want"))statusEl.classList.add("status_want");
						else if(this.classList.contains("status_reread"))statusEl.classList.add("status_reread");
						overlay.classList.add("open");
					});
				});
				function closeBookModal(){overlay.classList.remove("open");}
				closeBtn.addEventListener("click",closeBookModal);
				overlay.addEventListener("click",function(e){if(e.target===overlay)closeBookModal();});
				document.addEventListener("keydown",function(e){
					if(e.key==="Escape"&&overlay.classList.contains("open"))closeBookModal();
				});
			})();
