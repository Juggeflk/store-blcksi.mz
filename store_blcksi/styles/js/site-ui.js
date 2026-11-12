/* BLCKSI — interações globais de navegação das páginas internas */
(function () {
  'use strict';
  function initMenus() {
    if (document.body.classList.contains('store-home')) return; // homepage já usa home-ui.js
    document.querySelectorAll('.site-header .menu-toggle').forEach(function (button) {
      if (button.dataset.blcksiMenuReady === 'true') return;
      var header = button.closest('.site-header');
      var nav = header && header.querySelector('.nav-links');
      if (!nav) return;
      button.dataset.blcksiMenuReady = 'true';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', function () {
        var opened = nav.classList.toggle('is-open');
        button.classList.toggle('is-active', opened);
        button.setAttribute('aria-expanded', String(opened));
        button.setAttribute('aria-label', opened ? 'Fechar menu' : 'Abrir menu');
      });
      nav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('is-open');
          button.classList.remove('is-active');
          button.setAttribute('aria-expanded', 'false');
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMenus);
  else initMenus();
})();
