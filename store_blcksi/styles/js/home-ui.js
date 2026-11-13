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
  if (!root) return;

  var products = window.BLCKSI_PRODUCTS || [];
  var q = String(query || '').trim().toLocaleLowerCase('pt');

  function readHistory(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  var lastProduct = readHistory('blcksi_last_product');
  var lastCategory = readHistory('blcksi_last_category');

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('pt');
  }

  var ranked = products.map(function (p) {
    var name = normalize(p.name);
    var category = normalize(p.category);
    var description = normalize(p.description);
    var score = 0;

    if (q) {
      if (name === q) score += 100;
      else if (name.indexOf(q) !== -1) score += 60;

      if (category.indexOf(q) !== -1) score += 35;
      if (description.indexOf(q) !== -1) score += 15;
    }

    if (lastProduct && p.slug === lastProduct.slug) {
      score += q ? 2 : 0;
    }

    if (lastProduct && lastProduct.category &&
        category === normalize(lastProduct.category)) {
      score += 25;
    }

    if (lastCategory && category.indexOf(normalize(lastCategory.name)) !== -1) {
      score += 20;
    }

    return { product: p, score: score };
  });

  if (q) {
    ranked = ranked.filter(function (item) {
      var p = item.product;
      return normalize(p.name).indexOf(q) !== -1 ||
        normalize(p.category).indexOf(q) !== -1 ||
        normalize(p.description).indexOf(q) !== -1;
    });
  }

  ranked.sort(function (a, b) {
    return b.score - a.score;
  });

  var results = ranked.slice(0, 6);

  if (!products.length) {
    root.innerHTML = '<p>A carregar os produtos da loja...</p>';
    return;
  }

  if (!results.length) {
    root.innerHTML = '<p class="search-no-results">Não encontrámos este produto. Experimenta outro nome ou categoria.</p>';
    return;
  }

  root.innerHTML = results.map(function (item) {
    var p = item.product;
    var image = p.image_url || '../styles/assets/img/camisa-01.webp';
    var url = 'produto.html?slug=' + encodeURIComponent(p.slug || '');

    return '<a class="search-result" href="' + esc(url) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(p.name) + '">' +
      '<span><strong>' + esc(p.name) + '</strong>' +
      '<small>' + esc(p.category || 'BLCKSI') + '</small></span>' +
      '<b>' + money(p.price) + '</b></a>';
  }).join('');
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
