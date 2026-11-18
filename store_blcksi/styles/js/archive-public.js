(function(){
  'use strict';
  var db=window.BLCKSI_CLIENT;
  var sections=document.getElementById('archiveSections');
  var filters=document.getElementById('chapterFilters');
  var count=document.getElementById('archiveCount');
  var allChapters=[];
  var active='all';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function card(entry){
    var image=entry.cover_image_url;
    var media=image?'<div class="archive-card-media"><img src="'+esc(image)+'" alt="'+esc(entry.title)+'" loading="lazy"></div>':'<div class="archive-card-placeholder"><span>'+esc(entry.archive_code)+'</span><strong>'+esc(entry.title)+'</strong></div>';
    var desc=entry.description?'<p>'+esc(entry.description)+'</p>':'';
    var note=entry.historical_note?'<p class="archive-card-note">'+esc(entry.historical_note)+'</p>':'';
    return '<article class="archive-card">'+media+'<div class="archive-card-body"><span class="archive-card-code">'+esc(entry.archive_code)+'</span><h4>'+esc(entry.title)+'</h4>'+desc+note+'</div></article>';
  }
  function renderFilters(){
    filters.innerHTML='<button class="chapter-filter" type="button" data-filter="all" aria-pressed="'+(active==='all')+'">TODOS</button>'+allChapters.map(function(c){return '<button class="chapter-filter" type="button" data-filter="'+esc(c.id)+'" aria-pressed="'+(active===c.id)+'">'+esc(c.chapter_code)+' / '+esc(c.title)+'</button>';}).join('');
  }
  function render(){
    var shown=allChapters.filter(function(c){return active==='all'||c.id===active;});
    var total=shown.reduce(function(n,c){return n+c.entries.length;},0);
    count.textContent=shown.length+' CAPÍTULO(S) · '+total+' PEÇA(S)';
    if(!shown.length){sections.innerHTML='<div class="empty-state">O ARQUIVO ESTÁ A PREPARAR OS PRIMEIROS CAPÍTULOS.</div>';return;}
    sections.innerHTML=shown.map(function(c){
      var entries=c.entries.length?'<div class="masonry-grid">'+c.entries.map(card).join('')+'</div>':'<div class="empty-state">ESTE CAPÍTULO AINDA NÃO TEM PEÇAS PUBLICADAS.</div>';
      return '<section class="archive-chapter" id="chapter-'+esc(c.slug)+'"><header class="chapter-heading"><div><span class="chapter-code">'+esc(c.chapter_code)+' / '+esc(c.theme||'BLCKSI ARCHIVE')+'</span><h3>'+esc(c.title)+'</h3></div><p>'+esc(c.description||'Um capítulo da história BLCKSI.')+'</p></header>'+entries+'</section>';
    }).join('');
  }
  filters.addEventListener('click',function(e){var b=e.target.closest('[data-filter]');if(!b)return;active=b.dataset.filter;renderFilters();render();});
  async function init(){
    if(!db){sections.innerHTML='<div class="empty-state">NÃO FOI POSSÍVEL LIGAR AO ARQUIVO. TENTA NOVAMENTE MAIS TARDE.</div>';return;}
    try{
      var ch=await db.from('archive_chapters').select('id,chapter_code,title,slug,theme,description,cover_image_url,position').eq('is_published',true).order('position').order('created_at');
      if(ch.error)throw ch.error;
      var chapters=ch.data||[];
      if(!chapters.length){allChapters=[];renderFilters();render();return;}
      var ids=chapters.map(function(c){return c.id;});
      var er=await db.from('archive_entries').select('id,chapter_id,archive_code,title,slug,description,historical_note,cover_image_url,position,sequence_number').in('chapter_id',ids).eq('is_published',true).order('position').order('sequence_number');
      if(er.error)throw er.error;
      var entries=er.data||[];
      allChapters=chapters.map(function(c){return Object.assign({},c,{entries:entries.filter(function(e){return e.chapter_id===c.id;})});});
      renderFilters();render();
    }catch(err){
      console.error('BLCKSI Archive public load:',err);
      sections.innerHTML='<div class="empty-state">NÃO FOI POSSÍVEL CARREGAR O ARQUIVO. ATUALIZA A PÁGINA PARA TENTAR NOVAMENTE.</div>';
      count.textContent='ARQUIVO TEMPORARIAMENTE INDISPONÍVEL';
    }
  }
  init();
})();