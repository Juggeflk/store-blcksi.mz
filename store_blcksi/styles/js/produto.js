(function(){
  var params=new URLSearchParams(location.search), slug=params.get('slug'), container=document.getElementById('produtoContainer');
  var fallback={
    'blcksi-t-shirt-01':{name:'STAY WEIRD',price:950,description:'T-shirt BLCKSI com identidade streetwear e expressão gráfica. Escolhe o teu tamanho.',category:'T-shirt · BLCKSI',images:['../styles/assets/img/camisa-02.webp','../styles/assets/img/camisa-01.webp']},
    'blcksi-t-shirt-02':{name:'CULTURE OF AMBITION',price:950,description:'Uma peça BLCKSI para quem constrói o próprio caminho. Corte urbano e presença gráfica.',category:'T-shirt · BLCKSI',images:['../styles/assets/img/camisa-03.webp','../styles/assets/img/camisa-04.webp']},
    'blcksi-t-shirt-03':{name:'VIBIN',price:950,description:'T-shirt BLCKSI com uma estética descontraída e urbana. Escolhe o teu tamanho.',category:'T-shirt · BLCKSI',images:['../styles/assets/img/camisa-59.webp','../styles/assets/img/camisa-06.webp']},
    'blcksi-t-shirt-04':{name:'NANAMI KENTO',price:1200,description:'T-shirt gráfica BLCKSI inspirada na cultura anime e no streetwear.',category:'T-shirt · BLCKSI',images:['../styles/assets/img/camisa-07.webp','../styles/assets/img/camisa-08.webp']}
  };
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){return v==null?'Preço sob consulta':Number(v).toLocaleString('pt-MZ')+' MT'}
  function render(p){
    if(window.BLCKSIAnalytics)window.BLCKSIAnalytics.track('product_view',{slug:slug,category:p.category||''});
    var images=p.images&&p.images.length?p.images:['../styles/assets/img/camisa-01.webp'];
    document.title=p.name+' — BLCKSI';
    container.innerHTML='<div class="product-detail-v4"><div class="product-gallery"><button class="gallery-main-button" id="openGallery" type="button" aria-label="Ampliar imagem"><img id="galleryMain" src="'+esc(images[0])+'" alt="'+esc(p.name)+'"><span>⌕ AMPLIAR</span></button><div class="gallery-thumbnails">'+images.map(function(src,i){return '<button class="gallery-thumb '+(!i?'active':'')+'" type="button" data-index="'+i+'"><img src="'+esc(src)+'" alt="'+esc(p.name)+' vista '+(i+1)+'"></button>'}).join('')+'</div></div><div class="product-info-v4"><p class="eyebrow">'+esc(p.category||'BLCKSI')+'</p><h1>'+esc(p.name)+'</h1><div class="product-price-v4">'+money(p.price)+'</div><p class="product-description-v4">'+esc(p.description||'Sem descrição disponível.')+'</p><div class="product-options"><span>TAMANHO</span><div class="size-options" id="sizeOptions"><button type="button">S</button><button type="button" class="active">M</button><button type="button">L</button><button type="button">XL</button></div></div><button class="btn btn-light add-cart-btn" id="addCart" type="button">ADICIONAR AO CARRINHO</button><p class="product-note">As imagens podem ser ampliadas para visualizar melhor os detalhes.</p></div></div>';
    var active=0, main=document.getElementById('galleryMain'), thumbs=[].slice.call(document.querySelectorAll('.gallery-thumb'));
    function setImage(i){active=(i+images.length)%images.length;main.src=images[active];thumbs.forEach(function(t,n){t.classList.toggle('active',n===active)})}
    thumbs.forEach(function(t){t.addEventListener('click',function(){setImage(+t.dataset.index)})});
    document.querySelectorAll('#sizeOptions button').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('#sizeOptions button').forEach(function(x){x.classList.remove('active')});b.classList.add('active')})});
    var modal=document.getElementById('imageModal'), modalImg=document.getElementById('modalImage'), counter=document.getElementById('modalCounter');
    function open(){modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');modalImg.src=images[active];modalImg.alt=p.name;counter.textContent=(active+1)+' / '+images.length;document.body.style.overflow='hidden'}
    function close(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}
    function modalSet(i){setImage(i);modalImg.src=images[active];counter.textContent=(active+1)+' / '+images.length}
    document.getElementById('openGallery').addEventListener('click',open);modal.querySelector('.image-modal-close').addEventListener('click',close);modal.querySelector('.prev').addEventListener('click',function(){modalSet(active-1)});modal.querySelector('.next').addEventListener('click',function(){modalSet(active+1)});modal.addEventListener('click',function(e){if(e.target===modal)close()});document.addEventListener('keydown',function(e){if(!modal.classList.contains('is-open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')modalSet(active-1);if(e.key==='ArrowRight')modalSet(active+1)});
    document.getElementById('addCart').addEventListener('click',function(){var sizeEl=document.querySelector('#sizeOptions button.active');var added=window.BLCKSICart&&window.BLCKSICart.add({slug:slug,name:p.name,price:p.price,image:images[0],size:sizeEl?sizeEl.textContent.trim():''});if(added){var b=document.getElementById('addCart');b.textContent='ADICIONADO ✓';setTimeout(function(){b.textContent='ADICIONAR AO CARRINHO'},1400);if(window.BLCKSIAnalytics)window.BLCKSIAnalytics.track('add_to_cart',{slug:slug,price:p.price})}else{alert('Não foi possível adicionar. Tente novamente.')}});
  }
  async function load(){
    var cfg=window.BLCKSI_SUPABASE||{}, ready=cfg.url&&cfg.key&&!cfg.url.includes('COLOQUE_AQUI');
    if(ready&&window.supabase&&slug){try{var c=window.supabase.createClient(cfg.url,cfg.key);var r=await c.from('products').select('name,slug,description,price,category:categories(name),product_images(image_url,position)').eq('slug',slug).eq('is_active',true).single();if(!r.error&&r.data){var imgs=(r.data.product_images||[]).sort(function(a,b){return(a.position||0)-(b.position||0)}).map(function(i){return i.image_url});return render({name:r.data.name,description:r.data.description,price:r.data.price,category:r.data.category&&r.data.category.name,images:imgs})}}catch(e){console.warn(e)}}
    if(fallback[slug])render(fallback[slug]);else container.innerHTML='<div class="catalog-empty">Produto não encontrado. <a href="index.html">Voltar à loja</a></div>';
  }
  load();
})();
