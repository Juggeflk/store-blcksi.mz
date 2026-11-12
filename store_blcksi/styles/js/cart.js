/* BLCKSI Store — carrinho persistente local, preparado para sincronização Supabase */
(function(){
  'use strict';
  var KEY='blcksi_cart_v1';
  function read(){try{var v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function write(items){try{localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new CustomEvent('blcksi:cart-updated',{detail:items}));return true}catch(e){return false}}
  function normalize(p){return {slug:String(p.slug||''),name:String(p.name||'Produto BLCKSI'),price:p.price==null?null:Number(p.price),image:String(p.image||''),size:String(p.size||''),qty:Math.max(1,Math.min(99,parseInt(p.qty,10)||1))}}
  function add(p){var item=normalize(p);if(!item.slug)return false;var items=read(),key=item.slug+'|'+item.size,found=items.find(function(x){return x.slug+'|'+(x.size||'')===key});if(found)found.qty=Math.min(99,found.qty+item.qty);else items.push(item);return write(items)}
  function update(slug,size,qty){var items=read(),it=items.find(function(x){return x.slug===slug&&(x.size||'')===(size||'')});if(!it)return;if(qty<=0)items=items.filter(function(x){return x!==it});else it.qty=Math.min(99,Math.max(1,parseInt(qty,10)||1));write(items)}
  function remove(slug,size){write(read().filter(function(x){return !(x.slug===slug&&(x.size||'')===(size||''))}))}
  function clear(){write([])}
  function count(){return read().reduce(function(n,x){return n+x.qty},0)}
  function total(){return read().reduce(function(n,x){return n+(Number(x.price)||0)*x.qty},0)}
  function money(v){return Number(v||0).toLocaleString('pt-MZ',{maximumFractionDigits:2})+' MT'}
  function refreshBadges(){document.querySelectorAll('.cart-count').forEach(function(el){el.textContent=count()})}
  window.BLCKSICart={read:read,add:add,update:update,remove:remove,clear:clear,count:count,total:total,money:money,refreshBadges:refreshBadges};
  document.addEventListener('DOMContentLoaded',refreshBadges);window.addEventListener('blcksi:cart-updated',refreshBadges);
})();
