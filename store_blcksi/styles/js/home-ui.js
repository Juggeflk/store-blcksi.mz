/* BLCKSI Store — interações da homepage */
(function () {
  'use strict';
  var drawer = document.getElementById('cartDrawer');
  var backdrop = document.getElementById('uiBackdrop');
  var searchPanel = document.getElementById('searchPanel');
  var searchInput = document.getElementById('storeSearch');
  var lastFocus = null;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function money(v) { return v == null ? 'Preço sob consulta' : Number(v).toLocaleString('pt-MZ') + ' MT'; }
  function closePanels() {
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (searchPanel) { searchPanel.classList.remove('is-open'); searchPanel.setAttribute('aria-hidden', 'true'); }
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('panel-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openPanel(panel, focusTarget) {
    if (!panel || !backdrop) return;
    lastFocus = document.activeElement;
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (searchPanel) { searchPanel.classList.remove('is-open'); searchPanel.setAttribute('aria-hidden', 'true'); }
    panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false'); backdrop.hidden = false;
    document.body.classList.add('panel-open');
    if (focusTarget) window.setTimeout(function () { focusTarget.focus(); }, 60);
  }
  function renderDrawer() {
    if (!window.BLCKSICart || !drawer) return;
    var items = BLCKSICart.read(), root = document.getElementById('drawerItems');
    var count = BLCKSICart.count();
    drawer.querySelector('.drawer-count').textContent = '(' + count + ')';
    document.getElementById('drawerSubtotal').textContent = BLCKSICart.money(BLCKSICart.total());
    if (!items.length) { root.innerHTML = '<div class="drawer-empty"><span>＋</span><p>O teu carrinho ainda está vazio.</p><small>Descobre as peças do drop atual.</small></div>'; return; }
    root.innerHTML = items.map(function (item) {
      return '<article class="drawer-item"><img src="' + esc(item.image) + '" alt="' + esc(item.name) + '"><div class="drawer-item-info"><a href="produto.html?slug=' + encodeURIComponent(item.slug) + '">' + esc(item.name) + '</a><small>' + (item.size ? 'Tamanho ' + esc(item.size) : 'Tamanho não selecionado') + '</small><strong>' + money(item.price) + '</strong><div class="drawer-qty"><button type="button" data-cart-action="minus" data-slug="' + esc(item.slug) + '" data-size="' + esc(item.size) + '" aria-label="Diminuir quantidade">−</button><span>' + item.qty + '</span><button type="button" data-cart-action="plus" data-slug="' + esc(item.slug) + '" data-size="' + esc(item.size) + '" aria-label="Aumentar quantidade">+</button><button type="button" class="drawer-remove" data-cart-action="remove" data-slug="' + esc(item.slug) + '" data-size="' + esc(item.size) + '">REMOVER</button></div></div></article>';
    }).join('');
  }
  function openCart() { renderDrawer(); openPanel(drawer); }
  function searchProducts(query) {
    var root = document.getElementById('searchResults');
    var cards = Array.prototype.slice.call(document.querySelectorAll('#homeProducts .product-card'));
    var q = query.trim().toLocaleLowerCase('pt');
    if (!q) { root.innerHTML = '<p>Pesquisa por nome ou categoria.</p>'; return; }
    var matches = cards.filter(function (card) { return card.textContent.toLocaleLowerCase('pt').indexOf(q) !== -1; }).slice(0, 6);
    root.innerHTML = matches.length ? matches.map(function (card) { return '<a class="search-result" href="' + esc(card.getAttribute('href')) + '">' + card.querySelector('img').outerHTML + '<span><strong>' + esc(card.querySelector('h3') ? card.querySelector('h3').textContent : card.textContent) + '</strong><small>' + esc(card.querySelector('.product-meta p') ? card.querySelector('.product-meta p').textContent : 'BLCKSI') + '</small></span><b>↗</b></a>'; }).join('') : '<p class="search-no-results">Não encontrámos resultados na seleção inicial. <a href="camisa.html">Explorar todos os produtos ↗</a></p>';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var cartButton = document.getElementById('openCart');
    if (cartButton) cartButton.addEventListener('click', openCart);
    var searchButton = document.querySelector('.search-trigger');
    if (searchButton) searchButton.addEventListener('click', function () { openPanel(searchPanel, searchInput); });
    if (backdrop) backdrop.addEventListener('click', closePanels);
    document.querySelectorAll('[data-close-drawer], [data-close-search]').forEach(function (button) { button.addEventListener('click', closePanels); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closePanels(); });
    if (searchInput) searchInput.addEventListener('input', function () { searchProducts(searchInput.value); });
    if (drawer) drawer.addEventListener('click', function (event) {
      var button = event.target.closest('[data-cart-action]'); if (!button) return;
      var item = BLCKSICart.read().find(function (x) { return x.slug === button.dataset.slug && (x.size || '') === (button.dataset.size || ''); });
      if (!item) return;
      if (button.dataset.cartAction === 'remove') BLCKSICart.remove(item.slug, item.size);
      else BLCKSICart.update(item.slug, item.size, item.qty + (button.dataset.cartAction === 'plus' ? 1 : -1));
      renderDrawer();
    });
    window.addEventListener('blcksi:cart-updated', renderDrawer);
    
  });
})();
