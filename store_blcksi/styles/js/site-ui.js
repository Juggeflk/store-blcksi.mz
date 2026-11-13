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
      function closeMenu() {
  nav.classList.remove("is-open");
  button.classList.remove("is-active");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Abrir menu");
}

button.addEventListener("click", function (event) {
  event.stopPropagation();

  var opened = nav.classList.toggle("is-open");
  button.classList.toggle("is-active", opened);
  button.setAttribute("aria-expanded", String(opened));
  button.setAttribute("aria-label", opened ? "Fechar menu" : "Abrir menu");
});

nav.addEventListener("click", function (event) {
  event.stopPropagation();
});

document.addEventListener("click", function (event) {
  if (nav.classList.contains("is-open") && !header.contains(event.target)) {
    closeMenu();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeMenu();
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
  
  // Fechar menus móveis ao tocar fora ou pressionar Escape
  document.addEventListener('click', function (event) {
    document.querySelectorAll('.site-header .nav-links.is-open').forEach(function (nav) {
      var header = nav.closest('.site-header');
      var button = header && header.querySelector('.menu-toggle');

      if (!nav.contains(event.target) &&
          !(button && button.contains(event.target))) {
        nav.classList.remove('is-open');

        if (button) {
          button.classList.remove('is-active');
          button.setAttribute('aria-expanded', 'false');
          button.setAttribute('aria-label', 'Abrir menu');
        }
      }
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    document.querySelectorAll('.site-header .nav-links.is-open').forEach(function (nav) {
      var header = nav.closest('.site-header');
      var button = header && header.querySelector('.menu-toggle');

      nav.classList.remove('is-open');

      if (button) {
        button.classList.remove('is-active');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', 'Abrir menu');
      }
    });
  });

})();
