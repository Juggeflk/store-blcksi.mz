/* BLCKSI Store — dados dinâmicos (Supabase com fallback local) */
(function () {
  var config = window.BLCKSI_SUPABASE || {};
  var hasSupabase = config.url && config.key &&
    !config.url.includes("COLOQUE_AQUI") && !config.key.includes("COLOQUE_AQUI");

  var fallbackProducts = [
    { name: "STAY WEIRD", category: "T-shirt · BLCKSI", image_url: "../styles/assets/img/camisa-02.webp", price: 950, is_new: true, slug: "blcksi-t-shirt-01" },
    { name: "CULTURE OF AMBITION", category: "T-shirt · BLCKSI", image_url: "../styles/assets/img/camisa-03.webp", price: 950, is_new: true, slug: "blcksi-t-shirt-02" },
    { name: "VIBIN", category: "T-shirt · BLCKSI", image_url: "../styles/assets/img/camisa-59.webp", price: 950, is_new: false, slug: "blcksi-t-shirt-03" },
    { name: "NANAMI KENTO", category: "T-shirt · BLCKSI", image_url: "../styles/assets/img/camisa-07.webp", price: 1200, is_new: false, slug: "blcksi-t-shirt-04" }
  ];

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  function money(value) {
    return value == null ? "— MT" : Number(value).toLocaleString("pt-MZ") + " MT";
  }

  function renderProducts(products) {
    var grid = document.getElementById("homeProducts");
    if (!grid) return;
    grid.innerHTML = products.slice(0, 4).map(function (p) {
      var url = "produto.html?slug=" + encodeURIComponent(p.slug || "");
      var colors = Array.isArray(p.available_colors) ? p.available_colors : [];
      var swatches = colors.map(function(color){return '<button type="button" class="product-color-swatch" data-color="'+esc(color)+'" title="'+esc(color)+'" aria-label="'+esc(color)+'" style="--swatch:'+({'Preto':'#111','Branco':'#fff','Creme':'#e8dfc8','Castanho':'#79533a'}[color]||'#888')+'"></button>';}).join('');
      return '<article class="product-card" data-home-product="'+esc(p.slug)+'">' +
        '<a class="product-card-link" href="' + url + '">' +
        '<div class="product-image"><img src="' + esc(p.image_url || "../styles/assets/img/camisa-01.webp") + '" alt="' + esc(p.name) + '" loading="lazy">' +
        (p.is_new ? '<span class="product-tag">NEW</span>' : '') +
        '<button type="button" class="quick-buy" aria-label="Adicionar '+esc(p.name)+' ao carrinho" data-quick-buy="'+esc(p.slug)+'">＋</button></div>' +
        '<div class="product-meta"><div><h3>' + esc(p.name) + '</h3><strong>' + money(p.price) + '</strong></div></div></a>' +
        (colors.length ? '<div class="product-swatches" aria-label="Cores disponíveis">'+swatches+'</div>' : '') +
        '<small class="quick-buy-feedback" aria-live="polite"></small></article>';
    }).join("");
  }

  async function loadSupabase() {
    if (!hasSupabase || !window.supabase) return false;
    try {
      var client = window.supabase.createClient(config.url, config.key);
      window.blcksiSupabase = client;

      var catResult = await client.from("categories").select("name,description,slug").eq("is_active", true).order("position");
      if (!catResult.error && Array.isArray(catResult.data)) {
        var categories = catResult.data.map(function (c) {
          return { name: c.name, description: c.description || "", url: "categoria.html?slug=" + encodeURIComponent(c.slug) };
        });
        if (categories.length) renderBLCKSICategories(categories);
      }

var productResult = await client.from("products")
  .select("id,name,slug,description,price,is_new,available_colors,category_id,category:categories(name,slug,is_active),product_images(image_url,position)")
  .eq("is_active", true)
  .order("created_at", { ascending: false });
      if (!productResult.error && Array.isArray(productResult.data) && productResult.data.length) {
      var visibleProducts = productResult.data.filter(function (p) {
        return !p.category || p.category.is_active === true;
      });
      window.BLCKSI_PRODUCTS = visibleProducts.map(function (p) {
  var images = (p.product_images || []).sort(function (a, b) {
    return (a.position || 0) - (b.position || 0);
  });

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description || "",
    price: p.price,
    available_colors: p.available_colors || [],
    is_new: p.is_new,
    category_id: p.category_id,
    category: p.category && p.category.name,
    category_slug: p.category && p.category.slug,
    image_url: images[0] && images[0].image_url
  };
});  renderProducts(visibleProducts.map(function (p) {
          var images = (p.product_images || []).sort(function(a,b){ return (a.position||0)-(b.position||0); });
          return {
            name: p.name, slug: p.slug, price: p.price, is_new: p.is_new,
            category: p.category && p.category.name,
            available_colors: p.available_colors || [],
            image_url: images[0] && images[0].image_url
          };
        }));
      }
      return true;
    } catch (err) {
      console.warn("BLCKSI Supabase: fallback local ativo.", err);
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderProducts(fallbackProducts);
    loadSupabase();
  });
})();
