// Link do formulario de contacto no Formspree (formspree.io -> o teu formulario -> endpoint).
// Substitui "COLOCAR_LINK_AQUI" pelo link completo, ex: "https://formspree.io/f/abcd1234"
var FORMSPREE_ENDPOINT = "https://formspree.io/f/mjgnvzno";

var THEME_KEY = "blcksiTema";

function blcksiAplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  var btn = document.getElementById("themeToggle");
  if (btn) {
    var icon = btn.querySelector("i");
    if (icon) { icon.className = tema === "neon" ? "ti ti-flame" : "ti ti-moon"; }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var temaAtual = document.documentElement.getAttribute("data-theme") || "dark";
  blcksiAplicarTema(temaAtual);

  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var novo = document.documentElement.getAttribute("data-theme") === "neon" ? "dark" : "neon";
      blcksiAplicarTema(novo);
      try { localStorage.setItem(THEME_KEY, novo); } catch (e) { /* localStorage indisponivel */ }
    });
  }

  var thumbs = document.querySelectorAll("#galleryThumbs button");
  var mainImg = document.getElementById("galleryMainImg");
  if (thumbs.length && mainImg) {
    thumbs.forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        thumbs.forEach(function (t) { t.classList.remove("active"); });
        thumb.classList.add("active");
        var src = thumb.getAttribute("data-img");
        if (src) { mainImg.src = src; }
      });
    });
  }

  var sizeButtons = document.querySelectorAll("#sizeOptions button");
  if (sizeButtons.length) {
    sizeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        sizeButtons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
      });
    });
  }

  var paymentMethods = document.querySelectorAll("#paymentMethods .payment-method");
  if (paymentMethods.length) {
    paymentMethods.forEach(function (method) {
      method.addEventListener("click", function () {
        paymentMethods.forEach(function (m) {
          m.classList.remove("active");
          m.innerHTML = "<span>" + m.getAttribute("data-method") + "</span>";
        });
        method.classList.add("active");
        method.innerHTML = "<span>" + method.getAttribute("data-method") + "</span><i class=\"ti ti-check\"></i>";
      });
    });
  }

  var confirmForm = document.getElementById("confirmForm");
  var paymentForm = document.getElementById("paymentForm");
  var formSuccess = document.getElementById("formSuccess");
  if (confirmForm && paymentForm && formSuccess) {
    confirmForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var pedido = window.PEDIDO_ATUAL;
      var nome = document.getElementById("nome");
      var contacto = document.getElementById("contacto");
      var localizacao = document.getElementById("localizacao");
      var metodoEl = document.querySelector("#paymentMethods .payment-method.active");
      var metodo = metodoEl ? metodoEl.getAttribute("data-method") : "";

      if (pedido && pedido.produto) {
        var linhas = [
          "Novo pedido — BLCKSI",
          "Produto: " + pedido.produto.nome,
          pedido.tamanho ? "Tamanho: " + pedido.tamanho : null,
          pedido.gsm ? "GSM: " + pedido.gsm + "-GSM" : null,
          "Preço: " + formatarPreco(pedido.preco || pedido.produto.preco),
          "Método: " + metodo,
          "Nome: " + (nome ? nome.value : ""),
          "Contacto: " + (contacto ? contacto.value : ""),
          "localizacao: " + (localizacao  ? localizacao.value : ""),
          "",
          "Nota: a partir do dia em que o pagamento for efetuado, começa a contar o prazo de entrega. A encomenda é entregue num espaço de até 14 dias."
        ].filter(Boolean);

        var texto = encodeURIComponent(linhas.join("\n"));
        var numeroWhatsapp = "258849220801";
        window.open("https://wa.me/" + numeroWhatsapp + "?text=" + texto, "_blank");
      }

      paymentForm.style.display = "none";
      formSuccess.style.display = "block";
    });
  }

  var contactForm = document.getElementById("contactForm");
  var contactSuccess = document.getElementById("contactSuccess");
  var contactError = document.getElementById("contactError");
  if (contactForm && contactSuccess) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var submitBtn = contactForm.querySelector("button[type=submit]");
      var textoOriginal = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "a enviar...";
      if (contactError) { contactError.style.display = "none"; }

      var dados = {
        nome: document.getElementById("cNome").value,
        contacto: document.getElementById("cContacto").value,
        localizacao: document.getElementById("cLocalizacao").value,
        mensagem: document.getElementById("cMensagem").value,
        _gotcha: document.getElementById("cGotcha").value
      };

      fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(dados)
      })
        .then(function (res) {
          if (!res.ok) { throw new Error("falha no envio"); }
          contactForm.style.display = "none";
          contactSuccess.style.display = "block";
        })
        .catch(function () {
          if (contactError) {
            contactError.style.display = "block";
          } else {
            alert("Não foi possível enviar a mensagem. Tente novamente ou contacte-nos pelo WhatsApp.");
          }
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = textoOriginal;
        });
    });
  }

  var amountButtons = document.querySelectorAll("#amountOptions button");
  var giftAmount = document.getElementById("giftAmount");
  if (amountButtons.length && giftAmount) {
    amountButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        amountButtons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        giftAmount.textContent = btn.getAttribute("data-amount");
      });
    });
  }
});

// BLCKSI Store v2 — categorias administráveis.
// Nesta fase funcionam a partir desta configuração local. Na integração Supabase,
// a fonte será substituída pela tabela `categories`, sem alterar o HTML da homepage.
window.BLCKSI_CATEGORIES = window.BLCKSI_CATEGORIES || [
  { name: "Camisetas", description: "Peças essenciais BLCKSI", url: "camisa.html" },
  { name: "Camisolas", description: "Drops e novas silhuetas", url: "camisola.html" },
  { name: "Calças", description: "Streetwear em construção", url: "calca.html" },
  { name: "Bonés", description: "Acessórios de identidade", url: "bone.html" },
  { name: "Acessórios", description: "Completa o teu look", url: "acessorio.html" },
  { name: "Coleções", description: "Edições e lançamentos especiais", url: "preto.html" }
];

function renderBLCKSICategories(categories) {
  var grid = document.getElementById("categoriesGrid");
  if (!grid) return;
  grid.innerHTML = categories.map(function (category, index) {
    return '<a class="category-card" href="' + category.url + '">' +
      '<span class="category-number">' + String(index + 1).padStart(2, "0") + '</span>' +
      '<div><h3>' + category.name + '</h3><p>' + category.description + '</p></div>' +
      '<span class="category-arrow">↗</span></a>';
  }).join("");
}

document.addEventListener("DOMContentLoaded", function () {
  renderBLCKSICategories(window.BLCKSI_CATEGORIES);
});

/* BLCKSI V7.1 — menu móvel nas páginas internas */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".site-header .menu-toggle").forEach(function (button) {
    if (button.dataset.blcksiMenuReady === "true") return;
    var header = button.closest(".site-header");
    var nav = header ? header.querySelector(".nav-links") : null;
    if (!nav) return;
    button.dataset.blcksiMenuReady = "true";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", function () {
      var opened = nav.classList.toggle("is-open");
      button.classList.toggle("is-active", opened);
      button.setAttribute("aria-expanded", String(opened));
      button.setAttribute("aria-label", opened ? "Fechar menu" : "Abrir menu");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        button.classList.remove("is-active");
        button.setAttribute("aria-expanded", "false");
      });
    });
  });
});
