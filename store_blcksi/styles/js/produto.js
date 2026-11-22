(function(){
  var params=new URLSearchParams(location.search), slug=params.get('slug'), container=document.getElementById('produtoContainer');
  var fallback={
    'blcksi-t-shirt-01':{name:'STAY WEIRD',price:950,description:'T-shirt BLCKSI com identidade streetwear e expressão gráfica. Escolhe o teu tamanho.',category:'T-shirt · BLCKSI',sizes:['S','M','L','XL'],images:['../styles/assets/img/camisa-02.webp','../styles/assets/img/camisa-01.webp'],colors:[]},
    'blcksi-t-shirt-02':{name:'CULTURE OF AMBITION',price:950,description:'Uma peça BLCKSI para quem constrói o próprio caminho. Corte urbano e presença gráfica.',category:'T-shirt · BLCKSI',sizes:['S','M','L','XL'],images:['../styles/assets/img/camisa-03.webp','../styles/assets/img/camisa-04.webp'],colors:[]},
    'blcksi-t-shirt-03':{name:'VIBIN',price:950,description:'T-shirt BLCKSI com uma estética descontraída e urbana. Escolhe o teu tamanho.',category:'T-shirt · BLCKSI',sizes:['S','M','L','XL'],images:['../styles/assets/img/camisa-59.webp','../styles/assets/img/camisa-06.webp'],colors:[]},
    'blcksi-t-shirt-04':{name:'NANAMI KENTO',price:1200,description:'T-shirt gráfica BLCKSI inspirada na cultura anime e no streetwear.',category:'T-shirt · BLCKSI',sizes:['S','M','L','XL'],images:['../styles/assets/img/camisa-07.webp','../styles/assets/img/camisa-08.webp'],colors:[]}
  };
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){return v==null?'Preço sob consulta':Number(v).toLocaleString('pt-MZ')+' MT'}
  function colorHex(value){var colors={'preto':'#111111','branco':'#ffffff','creme':'#e8dfc8','castanho':'#79533a','azul':'#315b9a','azul-marinho':'#172b4d','vermelho':'#c43b3b','verde':'#47734a','cinzento':'#929292','cinza':'#929292','rosa':'#d98ca8','amarelo':'#e2c34b'};return colors[String(value||'').trim().toLowerCase()]||'#888888'}
  function render(p){
    try {
      localStorage.setItem('blcksi_last_product', JSON.stringify({
        slug: slug,
        name: p.name,
        category: p.category || '',
        viewedAt: Date.now()
      }));
    } catch (e) {}

    if(window.BLCKSIAnalytics)window.BLCKSIAnalytics.track('product_view',{slug:slug,category:p.category||''});    var images=p.images&&p.images.length?p.images:['../styles/assets/img/camisa-01.webp'];
    document.title=p.name+' — BLCKSI';
    container.innerHTML='<div class="product-detail-v4"><div class="product-gallery"><button class="gallery-main-button" id="openGallery" type="button" aria-label="Ampliar imagem"><img id="galleryMain" src="'+esc(images[0])+'" alt="'+esc(p.name)+'"><span>⌕ AMPLIAR</span></button><div class="gallery-thumbnails">'+images.map(function(src,i){return '<button class="gallery-thumb '+(!i?'active':'')+'" type="button" data-index="'+i+'"><img src="'+esc(src)+'" alt="'+esc(p.name)+' vista '+(i+1)+'"></button>'}).join('')+'</div></div><div class="product-info-v4"><p class="eyebrow">'+esc(p.category||'BLCKSI')+'</p><h1>'+esc(p.name)+'</h1><div class="product-price-v4">'+money(p.price)+'</div><p class="product-description-v4">'+esc(p.description||'Sem descrição disponível.')+'</p>'+((p.sizes||[]).length?'<div class="product-options"><span>TAMANHO</span><div class="size-options" id="sizeOptions" role="group" aria-label="Selecionar tamanho">'+p.sizes.map(function(size,i){return '<button type="button" aria-pressed="'+(!i?'true':'false')+'"'+(!i?' class="active"':'')+'>'+esc(size)+'</button>'}).join('')+'</div></div>':'')+((p.colors||[]).length?'<div class="product-options"><span>COR</span><div class="color-options" id="colorOptions" role="group" aria-label="Selecionar cor">'+p.colors.map(function(color){return '<button type="button" class="color-option" data-product-color="'+esc(color)+'" aria-label="'+esc(color)+'" aria-pressed="false" title="'+esc(color)+'"><span class="product-color-dot" style="--product-color:'+colorHex(color)+'"></span><span>'+esc(color)+'</span></button>'}).join('')+'</div></div>':'')+'<button class="btn btn-light add-cart-btn" id="addCart" type="button">ADICIONAR AO CARRINHO</button><p class="product-note">As imagens podem ser ampliadas para visualizar melhor os detalhes.</p></div></div>';
    var active=0, main=document.getElementById('galleryMain'), thumbs=[].slice.call(document.querySelectorAll('.gallery-thumb'));
    function setImage(i){active=(i+images.length)%images.length;main.src=images[active];thumbs.forEach(function(t,n){t.classList.toggle('active',n===active)})}
    thumbs.forEach(function(t){t.addEventListener('click',function(){setImage(+t.dataset.index)})});
    var chosenColor='';document.querySelectorAll('[data-product-color]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-product-color]').forEach(function(x){x.classList.remove('active');x.setAttribute('aria-pressed','false')});b.classList.add('active');b.setAttribute('aria-pressed','true');chosenColor=b.dataset.productColor})});
    document.querySelectorAll('#sizeOptions button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('#sizeOptions button').forEach(function(x){x.classList.remove('active');x.setAttribute('aria-pressed','false')});b.classList.add('active');b.setAttribute('aria-pressed','true')})});
    var modal=document.getElementById('imageModal'), modalImg=document.getElementById('modalImage'), counter=document.getElementById('modalCounter');
    function open(){modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');modalImg.src=images[active];modalImg.alt=p.name;counter.textContent=(active+1)+' / '+images.length;document.body.style.overflow='hidden'}
    function close(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
    // Fechar ao deslizar para baixo no fundo da imagem
var touchStartY = 0;

modal.addEventListener('touchstart', function(e) {
  if (e.target !== modal) return;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

modal.addEventListener('touchend', function(e) {
  if (e.target !== modal) return;

  var touchEndY = e.changedTouches[0].clientY;

  if (touchEndY - touchStartY > 80) {
    close();
  }
}, { passive: true });
    function modalSet(i){setImage(i);modalImg.src=images[active];counter.textContent=(active+1)+' / '+images.length}
    document.getElementById('openGallery').addEventListener('click',open);modal.querySelector('.image-modal-close').addEventListener('click',close);modal.querySelector('.prev').addEventListener('click',function(){modalSet(active-1)});modal.querySelector('.next').addEventListener('click',function(){modalSet(active+1)});modal.addEventListener('click',function(e){if(e.target===modal)close()});document.addEventListener('keydown',function(e){if(!modal.classList.contains('is-open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')modalSet(active-1);if(e.key==='ArrowRight')modalSet(active+1)});
    document.getElementById('addCart').addEventListener('click',function(){var sizeEl=document.querySelector('#sizeOptions button.active');if((p.colors||[]).length&&!chosenColor){alert('Seleciona uma cor antes de adicionar ao carrinho.');return;}var added=window.BLCKSICart&&window.BLCKSICart.add({slug:slug,name:p.name,price:p.price,image:images[0],size:sizeEl?sizeEl.textContent.trim():'',color:chosenColor});if(added){var b=document.getElementById('addCart');b.textContent='ADICIONADO ✓';setTimeout(function(){b.textContent='ADICIONAR AO CARRINHO'},1400);if(window.BLCKSIAnalytics)window.BLCKSIAnalytics.track('add_to_cart',{slug:slug,price:p.price})}else{alert('Não foi possível adicionar. Tente novamente.')}});
  }
  async function load(){
    var cfg=window.BLCKSI_SUPABASE||{}, ready=cfg.url&&cfg.key&&!cfg.url.includes('COLOQUE_AQUI');
    if(ready&&window.supabase&&slug){try{var c=window.supabase.createClient(cfg.url,cfg.key);var r=await c.from('products').select('name,slug,description,price,category:categories(name),available_colors,sizes,product_images(image_url,position)').eq('slug',slug).eq('is_active',true).single();if(!r.error&&r.data){var imgs=(r.data.product_images||[]).sort(function(a,b){return(a.position||0)-(b.position||0)}).map(function(i){return i.image_url});return render({name:r.data.name,description:r.data.description,price:r.data.price,category:r.data.category&&r.data.category.name,colors:r.data.available_colors||[],sizes:r.data.sizes||[],images:imgs})}}catch(e){console.warn(e)}}
    if(fallback[slug])render(fallback[slug]);else container.innerHTML='<div class="catalog-empty">Produto não encontrado. <a href="index.html">Voltar à loja</a></div>';
  }
  load();
})();
