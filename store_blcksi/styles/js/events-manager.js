(function () {
  'use strict';
  var db = window.BLCKSI_CLIENT;
  var accessBox = document.getElementById('eventManagerAccess');
  var workspace = document.getElementById('eventManagerWorkspace');
  var eventsBox = document.getElementById('managedEvents');
  var inbox = document.getElementById('eventInbox');
  var replyPanel = document.getElementById('eventReplyPanel');
  var conversation = document.getElementById('eventConversation');
  var replyForm = document.getElementById('eventReplyForm');
  var replyStatus = document.getElementById('eventReplyStatus');
  var currentAdmin = null;
  var currentThread = null;
  var messageCache = [];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function deny(msg) { accessBox.innerHTML = '<h2>ACESSO RESTRITO</h2><p>' + esc(msg) + '</p><a href="admin.html">VOLTAR AO BACK OFFICE ↗</a>'; }
  async function loadEvents() {
    var r = await db.from('community_events').select('*').order('created_at',{ascending:false});
    if (r.error) { eventsBox.textContent = 'Erro ao carregar eventos: ' + r.error.message; return; }
    if (!r.data.length) { eventsBox.innerHTML = '<p>Ainda não existem eventos. Cria a primeira temporada.</p>'; return; }
    eventsBox.innerHTML = r.data.map(function(ev) {
      return '<article class="managed-event"><div><strong>' + esc(ev.season_label) + ' — ' + esc(ev.title) +
        '</strong><small>' + (ev.is_published ? 'PUBLICADO' : 'RASCUNHO') + ' · ' +
        (ev.event_date || 'DATA A ANUNCIAR') + '</small></div><button type="button" data-event-toggle="' +
        esc(ev.id) + '" data-published="' + String(ev.is_published) + '">' +
        (ev.is_published ? 'RETIRAR PUBLICAÇÃO' : 'PUBLICAR EVENTO') + '</button></article>';
    }).join('');
  }
  function groupThreads(rows) {
    var map = {};
    rows.slice().sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);}).forEach(function(m) {
      var key = m.event_id + ':' + m.member_id;
      if (!map[key]) map[key] = {event_id:m.event_id,member_id:m.member_id,messages:[]};
      map[key].messages.push(m);
    });
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){
      return new Date(b.messages[b.messages.length-1].created_at)-new Date(a.messages[a.messages.length-1].created_at);
    });
  }
  async function loadInbox() {
    inbox.innerHTML = '<p>A carregar mensagens...</p>';
    var r = await db.from('community_event_messages')
      .select('id,event_id,member_id,sender_id,message,created_at')
      .order('created_at',{ascending:false}).limit(300);
    if (r.error) { inbox.textContent = 'Erro ao carregar mensagens: ' + r.error.message; return; }
    messageCache = r.data || [];
    var threads = groupThreads(messageCache);
    if (!threads.length) { inbox.innerHTML = '<p>Ainda não recebeste pedidos de informação.</p>'; return; }
    inbox.innerHTML = threads.map(function(t,i) {
      var last = t.messages[t.messages.length-1];
      return '<article class="event-thread-row"><strong>MEMBRO ' + esc(t.member_id.slice(0,8)) +
        ' · ' + t.messages.length + ' MENSAGEM(NS)</strong><p>' + esc(last.message) +
        '</p><button type="button" class="event-thread-open" data-thread="' + i + '">ABRIR CONVERSA ↗</button></article>';
    }).join('');
    inbox.querySelectorAll('[data-thread]').forEach(function(b) {
      b.addEventListener('click', function(){ openThread(threads[Number(b.dataset.thread)]); });
    });
  }
  async function openThread(thread) {
    currentThread = thread;
    replyPanel.hidden = false;
    replyStatus.textContent = '';
    var ev = await db.from('community_events').select('title,season_label').eq('id',thread.event_id).maybeSingle();
    var title = ev.data ? ev.data.season_label + ' — ' + ev.data.title : 'EVENTO BLCKSI';
    var rows = thread.messages.slice().sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});
    conversation.innerHTML = '<p class="events-help">' + esc(title) + ' · MEMBRO ' + esc(thread.member_id) + '</p><div data-admin-conversation>' +
      rows.map(function(m){var own=m.sender_id===currentAdmin.id;return '<article class="community-message ' + (own?'is-admin':'') + '"><small>'+(own?'RESPOSTA BLCKSI':'PEDIDO DO MEMBRO')+' · '+new Date(m.created_at).toLocaleString('pt-MZ')+'</small><p>'+esc(m.message)+'</p></article>';}).join('') +
      '</div>';
    replyPanel.scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.getElementById('eventCreateForm').addEventListener('submit',async function(e){
    e.preventDefault();
    var form=e.currentTarget, data=new FormData(form), button=form.querySelector('button'), status=document.getElementById('eventCreateStatus');
    var key=String(data.get('season_key')||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
    var row={season_key:key,season_label:String(data.get('season_label')).trim(),title:String(data.get('title')).trim(),announcement:String(data.get('announcement')||'').trim()||null,event_date:String(data.get('event_date')||'')||null,created_by:currentAdmin.id,is_published:false,members_only:true,entrance_free:true,consumption_paid:true};
    if(!key){status.textContent='Define um código único para a temporada.';return;}
    button.disabled=true;status.textContent='A guardar...';
    var r=await db.from('community_events').insert(row);
    button.disabled=false;
    if(r.error){status.textContent='Não foi possível guardar: '+r.error.message;return;}
    form.reset();status.textContent='Evento criado como rascunho.';await loadEvents();
  });
  eventsBox.addEventListener('click',async function(e){
    var b=e.target.closest('[data-event-toggle]');if(!b)return;
    var next=b.dataset.published!=='true';
    if(!confirm(next?'Publicar este evento da temporada?':'Retirar este evento da comunidade?'))return;
    b.disabled=true;
    var r=await db.from('community_events').update({is_published:next,published_at:next?new Date().toISOString():null}).eq('id',b.dataset.eventToggle);
    if(r.error)alert('Não foi possível actualizar o evento: '+r.error.message);
    await loadEvents();
  });
  replyForm.addEventListener('submit',async function(e){
    e.preventDefault();if(!currentThread)return;
    var field=replyForm.elements.message, body=String(field.value||'').trim();if(!body)return;
    var b=replyForm.querySelector('button');b.disabled=true;replyStatus.textContent='A enviar resposta...';
    var r=await db.from('community_event_messages').insert({event_id:currentThread.event_id,member_id:currentThread.member_id,sender_id:currentAdmin.id,message:body});
    b.disabled=false;
    if(r.error){replyStatus.textContent='Não foi possível enviar a resposta: '+r.error.message;return;}
    field.value='';replyStatus.textContent='Resposta enviada.';await loadInbox();await loadInboxAndReopen();
  });
  async function loadInboxAndReopen(){
    var r=await db.from('community_event_messages').select('id,event_id,member_id,sender_id,message,created_at').eq('event_id',currentThread.event_id).eq('member_id',currentThread.member_id).order('created_at');
    if(!r.error){currentThread.messages=r.data;await openThread(currentThread);}
  }
  async function init(){
    if(!db){deny('Ligação ao Supabase indisponível.');return;}
    var u=await db.auth.getUser();
    if(u.error||!u.data.user){deny('Inicia sessão no Back Office e abre novamente esta página.');return;}
    var p=await db.from('profiles').select('role').eq('id',u.data.user.id).maybeSingle();
    if(p.error||!p.data||p.data.role!=='admin'){deny('Esta conta não tem permissões de administrador.');return;}
    currentAdmin=u.data.user;accessBox.hidden=true;workspace.hidden=false;
    await loadEvents();await loadInbox();
  }
  init().catch(function(e){deny('Não foi possível validar o acesso.');console.error(e);});
})();