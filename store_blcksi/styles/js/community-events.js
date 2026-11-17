(function () {
  'use strict';
  var db = window.BLCKSI_CLIENT;
  var authBox = document.getElementById('communityAuth');
  var eventsBox = document.getElementById('communityEvents');
  var eventList = document.getElementById('communityEventList');
  var threadBox = document.getElementById('communityThread');
  var messageList = document.getElementById('communityMessages');
  var loginForm = document.getElementById('communityLogin');
  var loginMessage = document.getElementById('communityLoginMessage');
  var messageForm = document.getElementById('communityMessageForm');
  var messageStatus = document.getElementById('communityMessageStatus');
  var activeUser = null;
  var activeEvent = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function date(v) {
    if (!v) return 'DATA A ANUNCIAR';
    return new Date(v + 'T12:00:00').toLocaleDateString('pt-MZ', {day:'2-digit',month:'long',year:'numeric'});
  }
  function showLogin(message) {
    authBox.hidden = false; eventsBox.hidden = true;
    loginMessage.textContent = message || '';
  }
  async function loadEvents() {
    eventList.innerHTML = '<p>A carregar o evento da temporada...</p>';
    var result = await db.from('community_events')
      .select('id,season_label,title,announcement,event_date')
      .eq('is_published', true).order('created_at', {ascending:false}).limit(1);
    if (result.error) {
      eventList.textContent = 'Não foi possível carregar os eventos: ' + result.error.message;
      return;
    }
    if (!result.data || !result.data.length) {
      eventList.innerHTML = '<p class="community-event-meta">AINDA NÃO EXISTE UMA FESTA PUBLICADA PARA ESTA TEMPORADA.</p>';
      return;
    }
    var ev = result.data[0];
    eventList.innerHTML = '<article class="community-event-card"><div><p class="community-kicker">' +
      esc(ev.season_label) + ' / BLCKSI SEASON EVENT</p><h3>' + esc(ev.title) +
      '</h3><p>' + esc(ev.announcement || 'Uma experiência social criada pela BLCKSI.') +
      '</p><div class="community-event-meta">' + date(ev.event_date) +
      ' · ENTRADA GRATUITA · CONSUMO PAGO INDIVIDUALMENTE</div></div>' +
      '<button type="button" id="requestEventInfo">PEDIR LOCAL E HORÁRIO ↗</button></article>';
    activeEvent = ev;
    document.getElementById('requestEventInfo').addEventListener('click', async function () {
      threadBox.hidden = false;
      await loadMessages();
      threadBox.scrollIntoView({behavior:'smooth',block:'start'});
      document.getElementById('communityMessage').focus();
    });
  }
  async function loadMessages() {
    if (!activeEvent || !activeUser) return;
    messageList.innerHTML = '<p>A carregar mensagens...</p>';
    var result = await db.from('community_event_messages')
      .select('id,sender_id,message,created_at')
      .eq('event_id', activeEvent.id).eq('member_id', activeUser.id)
      .order('created_at', {ascending:true});
    if (result.error) {
      messageList.textContent = 'Não foi possível carregar a conversa: ' + result.error.message;
      return;
    }
    if (!result.data.length) {
      messageList.innerHTML = '<p class="community-event-meta">Ainda não enviaste mensagens sobre este evento.</p>';
      return;
    }
    messageList.innerHTML = result.data.map(function (m) {
      var adminReply = m.sender_id !== activeUser.id;
      return '<article class="community-message' + (adminReply ? ' is-admin' : '') + '"><small>' +
        (adminReply ? 'RESPOSTA BLCKSI' : 'A TUA MENSAGEM') + ' · ' +
        new Date(m.created_at).toLocaleString('pt-MZ') + '</small><p>' + esc(m.message) +
        '</p></article>';
    }).join('');
  }
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var button = loginForm.querySelector('button');
    var data = new FormData(loginForm);
    button.disabled = true; loginMessage.textContent = 'A iniciar sessão...';
    var result = await db.auth.signInWithPassword({
      email: String(data.get('email')).trim(),
      password: String(data.get('password'))
    });
    button.disabled = false;
    if (result.error) { loginMessage.textContent = 'Não foi possível entrar. Verifica os dados e tenta novamente.'; return; }
    activeUser = result.data.user;
    await init();
  });
  messageForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var field = messageForm.elements.message;
    var message = String(field.value || '').trim();
    if (!message || !activeEvent || !activeUser) return;
    var button = messageForm.querySelector('button');
    button.disabled = true; messageStatus.textContent = 'A enviar...';
    var result = await db.from('community_event_messages').insert({
      event_id: activeEvent.id, member_id: activeUser.id,
      sender_id: activeUser.id, message: message
    });
    button.disabled = false;
    if (result.error) { messageStatus.textContent = 'Não foi possível enviar a mensagem. Tenta novamente.'; return; }
    field.value = ''; messageStatus.textContent = 'Mensagem enviada à BLCKSI.';
    await loadMessages();
  });
  document.getElementById('communityLogout').addEventListener('click', async function () {
    await db.auth.signOut(); activeUser = null; activeEvent = null; showLogin('Sessão terminada.');
  });
  async function init() {
    var session = await db.auth.getUser();
    if (session.error || !session.data.user) { showLogin('Entra com a tua conta de membro para aceder aos eventos.'); return; }
    activeUser = session.data.user;
    authBox.hidden = true; eventsBox.hidden = false;
    await loadEvents();
  }
  if (!db) showLogin('A ligação à comunidade não está disponível neste momento.');
  else init().catch(function (err) { showLogin('Ocorreu um erro ao abrir a comunidade.'); console.error(err); });
})();