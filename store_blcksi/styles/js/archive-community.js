(function(){
'use strict';
var db=window.BLCKSI_CLIENT, user=null;
var authBox=document.getElementById('memberAuth'), area=document.getElementById('memberArea');
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function statusName(s){return ({pending:'EM ANÁLISE',approved:'APROVADA',rejected:'REJEITADA',changes_requested:'CORREÇÃO SOLICITADA'})[s]||s;}
async function loadPosts(){
var box=document.getElementById('myPosts');box.textContent='A carregar...';
var r=await db.from('community_posts').select('id,caption,status,moderation_note,created_at,community_post_images(image_url,storage_path,position)').eq('member_id',user.id).order('created_at',{ascending:false});
if(r.error){box.textContent='Não foi possível carregar: '+r.error.message;return;}
box.innerHTML=r.data.length?r.data.map(function(p){var imgs=(p.community_post_images||[]).sort(function(a,b){return a.position-b.position;}).map(function(i){return '<img src="'+esc(i.image_url)+'" alt="Fotografia da publicação">';}).join('');return '<article class="member-post" data-member-post="'+p.id+'"><strong>'+statusName(p.status)+'</strong><p>'+esc(p.caption)+'</p>'+imgs+(p.moderation_note?'<p class="member-note">NOTA DA BLCKSI: '+esc(p.moderation_note)+'</p>':'')+'<small class="member-note">'+new Date(p.created_at).toLocaleString('pt-MZ')+'</small>'+(p.status==='rejected'||p.status==='changes_requested'?'<p><button type="button" data-resubmit="'+p.id+'">CORRIGIR E REENVIAR</button></p>':'')+'</article>';}).join(''):'<p class="member-note">Ainda não tens publicações.</p>';
}
async function init(){
var u=await db.auth.getUser();if(u.error||!u.data.user){authBox.hidden=false;area.hidden=true;return;}
user=u.data.user;authBox.hidden=true;area.hidden=false;
var p=await db.from('profiles').select('nickname').eq('id',user.id).maybeSingle();
if(!p.error&&p.data&&p.data.nickname)document.querySelector('#nicknameForm [name=nickname]').value=p.data.nickname;
await loadPosts();
}
document.getElementById('memberLogin').addEventListener('submit',async function(e){e.preventDefault();var f=e.currentTarget;var b=f.querySelector('button');b.disabled=true;var r=await db.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});b.disabled=false;document.getElementById('memberLoginStatus').textContent=r.error?'Não foi possível entrar. Verifica os dados.':'';if(!r.error)init();});
document.getElementById('nicknameForm').addEventListener('submit',async function(e){e.preventDefault();var n=e.currentTarget.elements.nickname.value.trim();var b=e.currentTarget.querySelector('button');b.disabled=true;var r=await db.from('profiles').update({nickname:n}).eq('id',user.id);b.disabled=false;document.getElementById('nicknameStatus').textContent=r.error?(r.error.code==='23505'?'Este nickname já está ocupado. Escolhe outro.':'Não foi possível guardar: '+r.error.message):'Nickname guardado: @'+n;});
document.getElementById('postForm').addEventListener('submit',async function(e){
e.preventDefault();var f=e.currentTarget,files=Array.from(f.elements.images.files),b=f.querySelector('button'),out=document.getElementById('postStatus');
if((!files.length&&!f.dataset.resubmit)||files.length>5){out.textContent='Escolhe entre 1 e 5 fotografias.';return;}
if(files.some(function(x){return !['image/jpeg','image/png','image/webp'].includes(x.type)||x.size>10485760;})){out.textContent='Formato inválido ou fotografia acima de 10 MB.';return;}
var profile=await db.from('profiles').select('nickname').eq('id',user.id).maybeSingle();if(profile.error||!profile.data||!profile.data.nickname){out.textContent='Guarda primeiro o teu nickname.';return;}
b.disabled=true;out.textContent='A criar publicação...';
var post=await db.from('community_posts').insert({member_id:user.id,author_nickname:profile.data.nickname,caption:f.elements.caption.value.trim(),status:'pending'}).select('id').single();
if(post.error){b.disabled=false;out.textContent='Não foi possível criar: '+post.error.message;return;}
var rows=[],failed=null;
for(var i=0;i<files.length;i++){var file=files[i],ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=user.id+'/'+post.data.id+'/'+crypto.randomUUID()+'.'+ext;
var up=await db.storage.from('community-media').upload(path,file,{contentType:file.type,upsert:false});
if(up.error){failed=up.error;break;}
var pub=db.storage.from('community-media').getPublicUrl(path);
rows.push({post_id:post.data.id,image_url:pub.data.publicUrl,storage_path:path,alt_text:'BLCKSI member gallery',position:i});
}
if(!failed){var ins=await db.from('community_post_images').insert(rows);if(ins.error)failed=ins.error;}
if(failed){out.textContent='A publicação foi guardada, mas houve um problema ao enviar as imagens. Contacta a BLCKSI para concluir o envio.';}else{f.reset();delete f.dataset.resubmit;f.elements.images.required=true;out.textContent='Recebido. A tua publicação está pendente de aprovação.';}
b.disabled=false;await loadPosts();
});
document.getElementById('myPosts').addEventListener('click',async function(e){var b=e.target.closest('[data-resubmit]');if(!b)return;var r=await db.from('community_posts').select('id,caption,status').eq('id',b.dataset.resubmit).single();if(r.error){alert('Não foi possível abrir a publicação.');return;}if(!['rejected','changes_requested'].includes(r.data.status))return;var form=document.getElementById('postForm');form.dataset.resubmit=r.data.id;form.elements.caption.value=r.data.caption||'';form.elements.images.required=false;document.getElementById('postStatus').textContent='A corrigir publicação devolvida pela BLCKSI. Selecciona as imagens corrigidas e envia novamente.';form.scrollIntoView({behavior:'smooth',block:'center'});});
document.getElementById('memberLogout').addEventListener('click',async function(){await db.auth.signOut();user=null;init();});
if(db)init().catch(function(e){console.error(e);});
})();