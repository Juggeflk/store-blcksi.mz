(function () {
  'use strict';

  var accessBox = document.getElementById('archiveAccess');
  var workspace = document.getElementById('archiveWorkspace');
  var db = window.BLCKSI_CLIENT;

  function deny(title, detail) {
    accessBox.innerHTML = '<p class="archive-overline">ACESSO RESTRITO</p><h2>' +
      title + '</h2><p>' + detail + '</p><a class="archive-login-link" href="admin.html">IR PARA O BACK OFFICE E ENTRAR ↗</a>';
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

      var profile = await db.from('profiles')
        .select('role')
        .eq('id', sessionResult.data.user.id)
        .maybeSingle();

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
    } catch (error) {
      deny('Erro na verificação.', 'O acesso não foi concedido. Volta ao Back Office e tenta novamente.');
      console.error('BLCKSI Archive access error:', error);
    }
  }

  verifyAccess();
})();