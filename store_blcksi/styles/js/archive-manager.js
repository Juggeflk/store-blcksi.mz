(function () {
  'use strict';

  var accessBox = document.getElementById('archiveAccess');
  var workspace = document.getElementById('archiveWorkspace');
  var db = window.BLCKSI_CLIENT;
  var chaptersCache = [];
  var entriesCache = [];\n  var editor = document.getElementById('archiveEditor');\n  var mediaBucket = 'archive-media';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]);
    });
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function deny(title, detail) {
    accessBox.innerHTML = '<p class="archive-overline">ACESSO RESTRITO</p><h2>' +
      escapeHtml(title) + '</h2><p>' + escapeHtml(detail) +
      '</p><a class="archive-login-link" href="admin.html">IR PARA O BACK OFFICE E ENTRAR ↗</a>';
  }

  function setMessage(target, message, isError) {
    var box = document.getElementById(target);
    if (!box) return;
    box.innerHTML = '<p class="archive-empty' + (isError ? ' is-error' : '') + '">' + escapeHtml(message) + '</p>';
  }

  function renderChapters() {
    var list = document.getElementById('chapterList');
    var count = document.getElementById('chapterCount');
    var select = document.querySelector('#entryForm select[name="chapter_id"]');
    count.textContent = chaptersCache.length + ' REGISTADOS';
    select.innerHTML = '<option value="">Selecciona um capítulo</option>' + chaptersCache.map(function (chapter) {
      return '<option value="' + escapeHtml(chapter.id) + '">' + escapeHtml(chapter.chapter_code + ' — ' + chapter.title) + '</option>';
    }).join('');

    if (!chaptersCache.length) {
      list.innerHTML = '<p class="archive-empty">Ainda não existem capítulos. Cria o primeiro acima.</p>';
      return;
    }

    list.innerHTML = chaptersCache.map(function (chapter) {
      return '<article class="archive-record"><div class="archive-record-main"><strong>' +
        escapeHtml(chapter.chapter_code) + ' / ' + escapeHtml(chapter.title) +
        '</strong><span>' + escapeHtml(chapter.theme || 'Sem tema definido') +
        ' · ' + (chapter.is_published ? 'PUBLICADO' : 'RASCUNHO') +
        '</span></div><div class="archive-record-actions"><button type="button" data-edit-chapter="' + escapeHtml(chapter.id) + '">EDITAR</button><button type="button" data-move-chapter="' + escapeHtml(chapter.id) + '" data-dir="-1">↑</button><button type="button" data-move-chapter="' + escapeHtml(chapter.id) + '" data-dir="1">↓</button><button type="button" data-toggle-chapter="' + escapeHtml(chapter.id) +
        '" data-published="' + String(chapter.is_published) + '">' +
        (chapter.is_published ? 'RETIRAR' : 'PUBLICAR') + '</button></div></article>';
    }).join('');
  }

  function renderEntries() {
    var list = document.getElementById('entryList');
    document.getElementById('entryCount').textContent = entriesCache.length + ' REGISTADAS';
    if (!entriesCache.length) {
      list.innerHTML = '<p class="archive-empty">Ainda não existem peças registadas.</p>';
      return;
    }

    list.innerHTML = entriesCache.map(function (entry) {
      var chapter = entry.archive_chapters || {};
      var canPublish = !!chapter.is_published;
      return '<article class="archive-record"><div class="archive-record-main"><strong>' +
        escapeHtml(entry.archive_code) + ' / ' + escapeHtml(entry.title) +
        '</strong><span>' + escapeHtml(chapter.title || 'Capítulo') + ' · ' +
        (entry.is_published ? 'PUBLICADO' : 'RASCUNHO') +
        '</span></div><div class="archive-record-actions"><button type="button" data-edit-entry="' + escapeHtml(entry.id) + '">EDITAR</button><button type="button" data-images="' + escapeHtml(entry.id) + '">IMAGENS</button><button type="button" data-preview="' + escapeHtml(entry.id) + '">PRÉ-VISUALIZAR</button><button type="button" data-toggle-entry="' + escapeHtml(entry.id) +
        '" data-published="' + String(entry.is_published) + '"' +
        ((!entry.is_published && !canPublish) ? ' disabled title="Publica primeiro o capítulo"' : '') +
        '>' + (entry.is_published ? 'RETIRAR' : 'PUBLICAR') + '</button></div></article>';
    }).join('');
  }

  async function loadArchive() {
    setMessage('chapterList', 'A carregar capítulos...');
    setMessage('entryList', 'A carregar peças...');
    var chapterResult = await db.from('archive_chapters').select('*').order('position').order('created_at');
    if (chapterResult.error) {
      setMessage('chapterList', 'Erro ao carregar capítulos: ' + chapterResult.error.message, true);
      return;
    }
    chaptersCache = chapterResult.data || [];
    renderChapters();

    var entryResult = await db.from('archive_entries')
      .select('*, archive_chapters(chapter_code,title,is_published), archive_entry_images(*)')
      .order('position').order('sequence_number');
    if (entryResult.error) {
      setMessage('entryList', 'Erro ao carregar peças: ' + entryResult.error.message, true);
      return;
    }
    entriesCache = entryResult.data || [];
    renderEntries();
  }

  async function verifyAccess() {
    if (!db || !window.BLCKSI_SUPABASE || !window.BLCKSI_SUPABASE.url || !window.BLCKSI_SUPABASE.key) {
      deny('Ligação indisponível.', 'Não foi possível iniciar a ligação ao serviço de autenticação.');
      return;
    }

    try {
      var sessionResult = await db.auth.getUser();
      if (sessionResult.error || !sessionResult.data.user) {
        deny('Inicia sessão primeiro.', 'Entra no Back Office com a tua conta administrativa. Depois, abre novamente o Archive Manager.');
        return;
      }

      var profile = await db.from('profiles').select('role')
        .eq('id', sessionResult.data.user.id).maybeSingle();

      if (profile.error) {
        deny('Não foi possível validar o perfil.', 'A sessão existe, mas a verificação do perfil falhou. Não foi concedido acesso ao Archive Manager.');
        return;
      }
      if (!profile.data || profile.data.role !== 'admin') {
        deny('Acesso não autorizado.', 'Esta conta não tem o perfil de administrador necessário para gerir o Archive.');
        return;
      }

      accessBox.hidden = true;
      workspace.hidden = false;
      await loadArchive();
    } catch (error) {
      deny('Erro na verificação.', 'O acesso não foi concedido. Volta ao Back Office e tenta novamente.');
      console.error('BLCKSI Archive access error:', error);
    }
  }

  var chapterForm = document.getElementById('chapterForm');
  chapterForm.elements.title.addEventListener('input', function () {
    if (!chapterForm.elements.slug.dataset.manual) chapterForm.elements.slug.value = slugify(this.value);
  });
  chapterForm.elements.slug.addEventListener('input', function () {
    chapterForm.elements.slug.dataset.manual = 'true';
  });
  chapterForm.onsubmit = async function (event) {
    event.preventDefault();
    var data = new FormData(chapterForm);
    var record = {
      chapter_code: String(data.get('chapter_code')).trim().toUpperCase(),
      title: String(data.get('title')).trim(),
      theme: String(data.get('theme') || '').trim() || null,
      slug: slugify(data.get('slug')),
      description: String(data.get('description') || '').trim() || null,
      position: chaptersCache.length,
      is_published: false
    };
    if (!/^CH[0-9]{2,}$/.test(record.chapter_code)) {
      alert('Usa o formato CH01, CH02, CH03...');
      return;
    }
    var button = chapterForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var result = await db.from('archive_chapters').insert(record);
      if (result.error) throw result.error;
      chapterForm.reset();
      delete chapterForm.elements.slug.dataset.manual;
      await loadArchive();
      alert('Capítulo criado como rascunho.');
    } catch (error) {
      alert('Não foi possível criar o capítulo: ' + error.message);
    } finally {
      button.disabled = false;
    }
  };

  var entryForm = document.getElementById('entryForm');
  entryForm.elements.title.addEventListener('input', function () {
    if (!entryForm.elements.slug.dataset.manual) entryForm.elements.slug.value = slugify(this.value);
  });
  entryForm.elements.slug.addEventListener('input', function () {
    entryForm.elements.slug.dataset.manual = 'true';
  });
  entryForm.onsubmit = async function (event) {
    event.preventDefault();
    var data = new FormData(entryForm);
    var record = {
      chapter_id: String(data.get('chapter_id') || ''),
      title: String(data.get('title')).trim(),
      slug: slugify(data.get('slug')),
      description: String(data.get('description') || '').trim() || null,
      historical_note: String(data.get('historical_note') || '').trim() || null,
      cover_image_url: String(data.get('cover_image_url') || '').trim() || null,
      is_published: false
    };
    if (!record.chapter_id) {
      alert('Selecciona o capítulo de origem da peça.');
      return;
    }
    var button = entryForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var result = await db.from('archive_entries').insert(record).select('archive_code').single();
      if (result.error) throw result.error;
      entryForm.reset();
      delete entryForm.elements.slug.dataset.manual;
      await loadArchive();
      alert('Peça registada: ' + result.data.archive_code + '. Ficou guardada como rascunho.');
    } catch (error) {
      alert('Não foi possível registar a peça: ' + error.message);
    } finally {
      button.disabled = false;
    }
  };

  document.getElementById('chapterList').addEventListener('click', async function (event) {
    var button = event.target.closest('[data-toggle-chapter]');
    if (!button) return;
    var chapter = chaptersCache.find(function (item) { return item.id === button.dataset.toggleChapter; });
    if (!chapter) return;
    var next = !chapter.is_published;
    if (next && !confirm('Publicar o capítulo ' + chapter.chapter_code + '?')) return;
    if (!next && !confirm('Retirar o capítulo ' + chapter.chapter_code + ' da área pública?')) return;
    button.disabled = true;
    var result = await db.from('archive_chapters').update({
      is_published: next,
      published_at: next ? new Date().toISOString() : null
    }).eq('id', chapter.id);
    if (result.error) alert('Não foi possível actualizar o capítulo: ' + result.error.message);
    await loadArchive();
  });

  document.getElementById('entryList').addEventListener('click', async function (event) {
    var button = event.target.closest('[data-toggle-entry]');
    if (!button || button.disabled) return;
    var entry = entriesCache.find(function (item) { return item.id === button.dataset.toggleEntry; });
    if (!entry) return;
    var next = !entry.is_published;
    if (next && !confirm('Publicar a peça ' + entry.archive_code + '?')) return;
    if (!next && !confirm('Retirar a peça ' + entry.archive_code + ' da área pública?')) return;
    button.disabled = true;
    var result = await db.from('archive_entries').update({
      is_published: next,
      published_at: next ? new Date().toISOString() : null
    }).eq('id', entry.id);
    if (result.error) alert('Não foi possível actualizar a peça: ' + result.error.message);
    await loadArchive();
  });


  function openEditor(title, body) { editor.hidden=false; editor.innerHTML='<div class="archive-editor-head"><div><p class="archive-overline">CURADORIA / EDIÇÃO</p><h3>'+escapeHtml(title)+'</h3></div><button type="button" data-close-editor>FECHAR ×</button></div>'+body; editor.scrollIntoView({behavior:'smooth',block:'start'}); }
  function editChapter(c) { openEditor('EDITAR CAPÍTULO','<form id="archiveEditChapter" class="archive-form" data-id="'+escapeHtml(c.id)+'"><label>CÓDIGO (FIXO)<input value="'+escapeHtml(c.chapter_code)+'" disabled></label><label>TÍTULO<input name="title" required value="'+escapeHtml(c.title)+'"></label><label>TEMA<input name="theme" value="'+escapeHtml(c.theme||'')+'"></label><label>SLUG<input name="slug" required value="'+escapeHtml(c.slug)+'"></label><label class="archive-form-wide">DESCRIÇÃO<textarea name="description">'+escapeHtml(c.description||'')+'</textarea></label><label class="archive-form-wide">CAPA (URL)<input name="cover_image_url" type="url" value="'+escapeHtml(c.cover_image_url||'')+'"></label><button type="submit">GUARDAR ALTERAÇÕES</button></form>'); }
  function editEntry(e) { openEditor('EDITAR PEÇA · '+e.archive_code,'<form id="archiveEditEntry" class="archive-form" data-id="'+escapeHtml(e.id)+'"><label>CÓDIGO HISTÓRICO (FIXO)<input value="'+escapeHtml(e.archive_code)+'" disabled></label><label>CAPÍTULO DE ORIGEM (FIXO)<input value="'+escapeHtml(e.chapter_code)+'" disabled></label><label>TÍTULO<input name="title" required value="'+escapeHtml(e.title)+'"></label><label>SLUG<input name="slug" required value="'+escapeHtml(e.slug)+'"></label><label class="archive-form-wide">DESCRIÇÃO<textarea name="description">'+escapeHtml(e.description||'')+'</textarea></label><label class="archive-form-wide">NOTA HISTÓRICA<textarea name="historical_note">'+escapeHtml(e.historical_note||'')+'</textarea></label><label class="archive-form-wide">CAPA (URL)<input name="cover_image_url" type="url" value="'+escapeHtml(e.cover_image_url||'')+'"></label><button type="submit">GUARDAR ALTERAÇÕES</button></form>'); }
  function manageImages(e) { var imgs=(e.archive_entry_images||[]).slice().sort((a,b)=>a.position-b.position); var rows=imgs.map(i=>'<article class="archive-image-item"><img src="'+escapeHtml(i.image_url)+'" alt=""><strong>'+(i.is_primary?'IMAGEM PRINCIPAL':'IMAGEM '+(i.position+1))+'</strong><div class="archive-image-actions">'+(!i.is_primary?'<button type="button" data-primary-image="'+escapeHtml(i.id)+'">DEFINIR PRINCIPAL</button>':'')+'<button type="button" data-delete-image="'+escapeHtml(i.id)+'">ELIMINAR</button></div></article>').join(''); openEditor('GALERIA · '+e.archive_code,'<p class="archive-empty">Adiciona várias imagens. A primeira será a principal; podes alterar esta escolha quando quiseres.</p><form id="archiveUploadImages" class="archive-form" data-id="'+escapeHtml(e.id)+'"><label class="archive-form-wide">IMAGENS (JPEG, PNG, WEBP · MÁX. 10 MB CADA)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label><label class="archive-form-wide">DESCRIÇÃO<input name="alt_text" maxlength="160" placeholder="Descrição das imagens"></label><button type="submit">CARREGAR IMAGENS +</button></form><div class="archive-image-grid">'+(rows||'<p class="archive-empty">Ainda não existem imagens adicionais.</p>')+'</div>'); }
  function previewEntry(e) { var imgs=(e.archive_entry_images||[]).slice().sort((a,b)=>a.position-b.position); var cover=e.cover_image_url||(imgs[0]&&imgs[0].image_url)||''; var w=window.open('','_blank'); if(!w){alert('Permite janelas pop-up para pré-visualizar.');return;} w.document.write('<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(e.archive_code)+'</title><style>body{margin:0;background:#080b0b;color:#f2f3ed;font:16px Arial}main{max-width:1000px;margin:auto;padding:6vw}small{color:#c9f36a;letter-spacing:.15em}h1{font-size:clamp(40px,8vw,90px)}p{line-height:1.8;color:#bdc8c0}.hero{width:100%;max-height:70vh;object-fit:cover}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.gallery img{width:100%;height:280px;object-fit:cover}</style><main><small>BLCKSI ARCHIVE / '+escapeHtml(e.archive_code)+'</small><h1>'+escapeHtml(e.title)+'</h1><p>'+escapeHtml(e.description||'')+'</p>'+(cover?'<img class="hero" src="'+escapeHtml(cover)+'">':'')+'<p>'+escapeHtml(e.historical_note||'')+'</p><div class="gallery">'+imgs.map(i=>'<img src="'+escapeHtml(i.image_url)+'">').join('')+'</div><p>BUILT TO EVOLVE · PRÉ-VISUALIZAÇÃO PRIVADA</p></main></html>'); w.document.close(); }
  async function refreshAndImages(id) { await loadArchive(); var e=entriesCache.find(x=>x.id===id); if(e)manageImages(e); }
  workspace.addEventListener('click',async function(ev){ var b=ev.target.closest('button'); if(!b)return; try {
    if(b.hasAttribute('data-close-editor')){editor.hidden=true;return;}
    if(b.dataset.editChapter){editChapter(chaptersCache.find(x=>x.id===b.dataset.editChapter));return;}
    if(b.dataset.editEntry){editEntry(entriesCache.find(x=>x.id===b.dataset.editEntry));return;}
    if(b.dataset.images){manageImages(entriesCache.find(x=>x.id===b.dataset.images));return;}
    if(b.dataset.preview){previewEntry(entriesCache.find(x=>x.id===b.dataset.preview));return;}
    if(b.dataset.moveEntry){var i=entriesCache.findIndex(x=>x.id===b.dataset.moveEntry),j=i+Number(b.dataset.dir);if(j<0||j>=entriesCache.length)return;var a=entriesCache[i],z=entriesCache[j];var r1=await db.from('archive_entries').update({position:z.position}).eq('id',a.id);if(r1.error)throw r1.error;var r2=await db.from('archive_entries').update({position:a.position}).eq('id',z.id);if(r2.error)throw r2.error;await loadArchive();return;}
    if(b.dataset.moveChapter){var i=chaptersCache.findIndex(x=>x.id===b.dataset.moveChapter),j=i+Number(b.dataset.dir);if(j<0||j>=chaptersCache.length)return;var a=chaptersCache[i],z=chaptersCache[j];var r1=await db.from('archive_chapters').update({position:z.position}).eq('id',a.id);if(r1.error)throw r1.error;var r2=await db.from('archive_chapters').update({position:a.position}).eq('id',z.id);if(r2.error)throw r2.error;await loadArchive();return;}
    if(b.dataset.primaryImage){var q=await db.from('archive_entry_images').select('*').eq('id',b.dataset.primaryImage).single();if(q.error)throw q.error;var r=await db.from('archive_entry_images').update({is_primary:false}).eq('entry_id',q.data.entry_id);if(r.error)throw r.error;r=await db.from('archive_entry_images').update({is_primary:true}).eq('id',q.data.id);if(r.error)throw r.error;r=await db.from('archive_entries').update({cover_image_url:q.data.image_url}).eq('id',q.data.entry_id);if(r.error)throw r.error;await refreshAndImages(q.data.entry_id);return;}
    if(b.dataset.deleteImage){var q=await db.from('archive_entry_images').select('*').eq('id',b.dataset.deleteImage).single();if(q.error)throw q.error;if(!confirm('Eliminar esta imagem da galeria?'))return;var r=await db.from('archive_entry_images').delete().eq('id',q.data.id);if(r.error)throw r.error;if(q.data.storage_path){var rm=await db.storage.from(mediaBucket).remove([q.data.storage_path]);if(rm.error)console.warn(rm.error.message);}if(q.data.is_primary){var next=await db.from('archive_entry_images').select('*').eq('entry_id',q.data.entry_id).order('position').limit(1);var url=next.data&&next.data[0]?next.data[0].image_url:null;if(next.data&&next.data[0])await db.from('archive_entry_images').update({is_primary:true}).eq('id',next.data[0].id);await db.from('archive_entries').update({cover_image_url:url}).eq('id',q.data.entry_id);}await refreshAndImages(q.data.entry_id);return;}
  }catch(err){alert('Não foi possível concluir: '+err.message);} });
  editor.addEventListener('click',async function(ev){var b=ev.target.closest('button');if(!b)return;try{
    if(b.hasAttribute('data-close-editor')){editor.hidden=true;return;}
    if(b.dataset.primaryImage){var q=await db.from('archive_entry_images').select('*').eq('id',b.dataset.primaryImage).single();if(q.error)throw q.error;var r=await db.from('archive_entry_images').update({is_primary:false}).eq('entry_id',q.data.entry_id);if(r.error)throw r.error;r=await db.from('archive_entry_images').update({is_primary:true}).eq('id',q.data.id);if(r.error)throw r.error;r=await db.from('archive_entries').update({cover_image_url:q.data.image_url}).eq('id',q.data.entry_id);if(r.error)throw r.error;await loadArchive();manageImages(entriesCache.find(x=>x.id===q.data.entry_id));return;}
    if(b.dataset.deleteImage){var q=await db.from('archive_entry_images').select('*').eq('id',b.dataset.deleteImage).single();if(q.error)throw q.error;if(!confirm('Eliminar esta imagem da galeria?'))return;var r=await db.from('archive_entry_images').delete().eq('id',q.data.id);if(r.error)throw r.error;if(q.data.storage_path){var rm=await db.storage.from(mediaBucket).remove([q.data.storage_path]);if(rm.error)console.warn(rm.error.message);}if(q.data.is_primary){var next=await db.from('archive_entry_images').select('*').eq('entry_id',q.data.entry_id).order('position').limit(1);var url=next.data&&next.data[0]?next.data[0].image_url:null;if(next.data&&next.data[0])await db.from('archive_entry_images').update({is_primary:true}).eq('id',next.data[0].id);await db.from('archive_entries').update({cover_image_url:url}).eq('id',q.data.entry_id);}await loadArchive();manageImages(entriesCache.find(x=>x.id===q.data.entry_id));return;}
  }catch(err){alert('Não foi possível concluir: '+err.message);}});
  editor.addEventListener('submit',async function(ev){ev.preventDefault();var f=ev.target;try{
    if(f.id==='archiveEditChapter'){var d=new FormData(f),r=await db.from('archive_chapters').update({title:String(d.get('title')).trim(),theme:String(d.get('theme')||'').trim()||null,slug:slugify(d.get('slug')),description:String(d.get('description')||'').trim()||null,cover_image_url:String(d.get('cover_image_url')||'').trim()||null}).eq('id',f.dataset.id);if(r.error)throw r.error;editor.hidden=true;await loadArchive();alert('Capítulo actualizado.');}
    if(f.id==='archiveEditEntry'){var d=new FormData(f),r=await db.from('archive_entries').update({title:String(d.get('title')).trim(),slug:slugify(d.get('slug')),description:String(d.get('description')||'').trim()||null,historical_note:String(d.get('historical_note')||'').trim()||null,cover_image_url:String(d.get('cover_image_url')||'').trim()||null}).eq('id',f.dataset.id);if(r.error)throw r.error;editor.hidden=true;await loadArchive();alert('Peça actualizada.');}
    if(f.id==='archiveUploadImages'){var files=Array.from(f.elements.images.files),id=f.dataset.id,alt=String(f.elements.alt_text.value||'').trim();if(!files.length)return;var current=await db.from('archive_entry_images').select('id,position').eq('entry_id',id);if(current.error)throw current.error;for(var i=0;i<files.length;i++){var file=files[i];if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)throw new Error('Cada imagem deve ser JPEG, PNG ou WEBP e ter até 10 MB.');var ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1],path=id+'/'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;var up=await db.storage.from(mediaBucket).upload(path,file,{contentType:file.type,upsert:false});if(up.error)throw up.error;var url=db.storage.from(mediaBucket).getPublicUrl(path).data.publicUrl;var first=current.data.length===0&&i===0;var ins=await db.from('archive_entry_images').insert({entry_id:id,image_url:url,storage_path:path,alt_text:alt||null,position:current.data.length+i,is_primary:first});if(ins.error){await db.storage.from(mediaBucket).remove([path]);throw ins.error;}if(first){var cap=await db.from('archive_entries').update({cover_image_url:url}).eq('id',id);if(cap.error)throw cap.error;}}await refreshAndImages(id);alert('Imagens carregadas.');}
  }catch(err){alert('Erro: '+err.message);} });
\n  verifyAccess();
})();