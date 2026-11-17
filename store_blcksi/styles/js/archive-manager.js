(function () {
  'use strict';

  var accessBox = document.getElementById('archiveAccess');
  var workspace = document.getElementById('archiveWorkspace');
  var db = window.BLCKSI_CLIENT;
  var chaptersCache = [];
  var entriesCache = [];

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
        '</span></div><button type="button" data-toggle-chapter="' + escapeHtml(chapter.id) +
        '" data-published="' + String(chapter.is_published) + '">' +
        (chapter.is_published ? 'RETIRAR' : 'PUBLICAR') + '</button></article>';
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
        '</span></div><button type="button" data-toggle-entry="' + escapeHtml(entry.id) +
        '" data-published="' + String(entry.is_published) + '"' +
        ((!entry.is_published && !canPublish) ? ' disabled title="Publica primeiro o capítulo"' : '') +
        '>' + (entry.is_published ? 'RETIRAR' : 'PUBLICAR') + '</button></article>';
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
      .select('id, sequence_number, archive_code, chapter_id, title, is_published, archive_chapters(chapter_code,title,is_published)')
      .order('sequence_number', {ascending:false});
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

  verifyAccess();
})();