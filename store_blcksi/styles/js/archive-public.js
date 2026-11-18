(function(){
  'use strict';
  var db=window.BLCKSI_CLIENT;
  var grid=document.getElementById('feedGrid');
  var status=document.getElementById('feedStatus');
  var sentinel=document.getElementById('feedSentinel');
  var menu=document.getElementById('archiveMenu');
  var menuToggle=document.getElementById('menuToggle');
  var menuChapters=document.getElementById('menuChapters');
  var dialog=document.getElementById('entryDialog');
  var dialogContent=document.getElementById('dialogContent');
  var dialogCode=document.getElementById('dialogCode');
  var chapters=[];
  var entries=[];
  var visible=[];
  var cursor=0;
  var pageSize=24;
  var activeChapter='all';
  var observer=null;
  var busy=false;
  var finished=false;
  var seen=new Set();

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function setMenu(open){menu.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');}
  menuToggle.addEventListener('click',function(){setMenu(menu.hidden);});
  document.getElementById('menuClose').addEventListener('click',function(){setMenu(false);});
  menu.addEventListener('click',function(e){var a=e.target.closest('[data-menu-close]');if(a)setMenu(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false);});
  document.getElementById('dialogClose').addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});

  function chapterLabel(id){var c=chapters.find(function(x){return x.id===id;});return c?c.chapter_code+' / '+c.title:'BLCKSI ARCHIVE';}
  function renderMenu(){
    if(!chapters.length){menuChapters.innerHTML='<span class="menu-muted">Os primeiros capítulos serão apresentados aqui.</span>';return;}
    menuChapters.innerHTML='<button type="button" data-chapter="all">TODOS OS CAPÍTULOS</button>'+chapters.map(function(c){return '<button type="button" data-chapter="'+esc(c.id)+'">'+esc(c.chapter_code)+' / '+esc(c.title)+'</button>';}).join('');
    menuChapters.querySelectorAll('[data-chapter]').forEach(function(b){b.addEventListener('click',function(){activeChapter=b.dataset.chapter;visible=activeChapter==='all'?entries.slice():entries.filter(function(e){return e.chapter_id===activeChapter;});cursor=0;finished=false;seen.clear();grid.innerHTML='';status.textContent='';setMenu(false);loadPage();window.scrollTo({top:0,behavior:'smooth'});});});
  }
  function imageFor(e){return e.cover_image_url||e.primary_image_url||null;}
  function card(e){
    var src=imageFor(e);
    var visual=src?'<img src="'+esc(src)+'" alt="'+esc(e.title)+'" loading="lazy">':'<div class="feed-card-placeholder"><small>'+esc(e.archive_code)+'</small><strong>'+esc(e.title)+'</strong></div>';
    var c=chapterLabel(e.chapter_id);
    return '<button class="feed-card" type="button" data-entry="'+esc(e.id)+'" aria-label="Abrir '+esc(e.title)+'">'+visual+'<span class="feed-card-caption"><small>'+esc(e.archive_code)+' · '+esc(c)+'</small><strong>'+esc(e.title)+'</strong></span></button>';
  }
  function appendCards(batch){var html=batch.map(card).join('');grid.insertAdjacentHTML('beforeend',html);batch.forEach(function(e){seen.add(e.id);});}
  function loadPage(){
    if(busy||finished)return;
    busy=true;
    var batch=visible.slice(cursor,cursor+pageSize);
    if(!batch.length){finished=true;status.textContent=visible.length?'FIM DO ACERVO — MAIS REGISTOS SERÃO ADICIONADOS PELA CURADORIA.':'AINDA NÃO EXISTEM PEÇAS PUBLICADAS.';busy=false;return;}
    appendCards(batch);
    cursor+=batch.length;
    if(cursor>=visible.length){finished=true;status.textContent='FIM DO ACERVO — MAIS REGISTOS SERÃO ADICIONADOS PELA CURADORIA.';}
    busy=false;
  }
  grid.addEventListener('click',function(e){var b=e.target.closest('[data-entry]');if(!b)return;var entry=entries.find(function(x){return x.id===b.dataset.entry;});if(entry)openEntry(entry);});
  async function openEntry(entry){
    dialogCode.textContent=entry.archive_code+' / '+chapterLabel(entry.chapter_id);
    var cover=imageFor(entry);
    var imgs=Array.isArray(entry.archive_entry_images)?entry.archive_entry_images.slice().sort(function(a,b){return (a.position||0)-(b.position||0);}):[];
    var main=cover?'<img class="dialog-main-image" src="'+esc(cover)+'" alt="'+esc(entry.title)+'">':'';
    var gallery=imgs.filter(function(i){return i.image_url&&i.image_url!==cover;});
    var galleryHtml=gallery.length?'<div class="dialog-gallery">'+gallery.map(function(i){return '<img src="'+esc(i.image_url)+'" alt="'+esc(i.alt_text||entry.title)+'" loading="lazy">';}).join('')+'</div>':'';
    dialogContent.innerHTML='<article class="dialog-body"><span class="dialog-meta">'+esc(entry.archive_code)+' / '+esc(chapterLabel(entry.chapter_id))+'</span><h2 id="dialogTitle">'+esc(entry.title)+'</h2>'+(entry.description?'<p>'+esc(entry.description)+'</p>':'')+main+(entry.historical_note?'<p>'+esc(entry.historical_note)+'</p>':'')+galleryHtml+'</article>';
    if(!dialog.open)dialog.showModal();
    try{
      var result=await db.from('archive_entry_images').select('id,image_url,alt_text,position,is_primary').eq('entry_id',entry.id).order('position');
      if(!result.error&&result.data&&result.data.length){var fresh=result.data;var primary=fresh.find(function(i){return i.is_primary;});if(primary&&!cover){cover=primary.image_url;main='<img class="dialog-main-image" src="'+esc(cover)+'" alt="'+esc(entry.title)+'">';}gallery=fresh.filter(function(i){return i.image_url!==cover;});galleryHtml=gallery.length?'<div class="dialog-gallery">'+gallery.map(function(i){return '<img src="'+esc(i.image_url)+'" alt="'+esc(i.alt_text||entry.title)+'" loading="lazy">';}).join('')+'</div>':'';dialogContent.querySelector('.dialog-main-image')?.remove();var old=dialogContent.querySelector('.dialog-gallery');if(old)old.remove();if(main)dialogContent.querySelector('.dialog-body').insertAdjacentHTML('beforeend',main);if(galleryHtml)dialogContent.querySelector('.dialog-body').insertAdjacentHTML('beforeend',galleryHtml);}
    }catch(err){console.warn('Não foi possível carregar a galeria do registo.',err);}
  }
  async function init(){
    if(!db){grid.innerHTML='<div class="feed-state">NÃO FOI POSSÍVEL LIGAR AO ACERVO.</div>';return;}
    try{
      var ch=await db.from('archive_chapters').select('id,chapter_code,title,slug,position').eq('is_published',true).order('position').order('created_at');
      if(ch.error)throw ch.error;
      chapters=ch.data||[];
      renderMenu();
      if(!chapters.length){grid.innerHTML='<div class="feed-state">O ACERVO ESTÁ A PREPARAR OS PRIMEIROS CAPÍTULOS.</div>';status.textContent='AS PRIMEIRAS IMAGENS SERÃO PUBLICADAS PELA CURADORIA.';return;}
      var ids=chapters.map(function(c){return c.id;});
      var result=await db.from('archive_entries').select('id,chapter_id,archive_code,title,slug,description,historical_note,cover_image_url,position,sequence_number,archive_entry_images(id,image_url,alt_text,position,is_primary)').in('chapter_id',ids).eq('is_published',true).order('position').order('sequence_number');
      if(result.error)throw result.error;
      entries=(result.data||[]).filter(function(e){return !seen.has(e.id);});
      // Interleave chapter entries in round-robin order to create a mixed discovery feed.
      var buckets=chapters.map(function(c){return entries.filter(function(e){return e.chapter_id===c.id;});});
      var mixed=[];var max=Math.max.apply(null,buckets.map(function(b){return b.length;}).concat([0]));
      for(var i=0;i<max;i++){buckets.forEach(function(bucket){if(bucket[i])mixed.push(bucket[i]);});}
      entries=mixed;
      visible=entries.slice();
      loadPage();
      if('IntersectionObserver' in window){observer=new IntersectionObserver(function(items){if(items.some(function(i){return i.isIntersecting;}))loadPage();},{rootMargin:'900px 0px'});observer.observe(sentinel);}
    }catch(err){console.error('BLCKSI Archive visual feed:',err);grid.innerHTML='<div class="feed-state">NÃO FOI POSSÍVEL CARREGAR O ACERVO. ATUALIZA A PÁGINA PARA TENTAR NOVAMENTE.</div>';status.textContent='ARQUIVO TEMPORARIAMENTE INDISPONÍVEL';}
  }
  init();
})();