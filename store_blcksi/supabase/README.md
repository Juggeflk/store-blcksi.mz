# BLCKSI Store — configuração Supabase V5

## 1. Base de dados
No SQL Editor do Supabase, executar `schema.sql` completo. O script adiciona pedidos, linhas de pedido, eventos de métricas, políticas RLS e bucket `product-images`.

## 2. Frontend
Em `styles/js/supabase-config.js`, configurar apenas a URL e a chave pública/publishable (anon). Nunca colocar `service_role` no browser, no ZIP ou no repositório.

## 3. Criar o primeiro administrador
Criar a conta em Authentication > Users. Depois executar no SQL Editor, substituindo pelo UUID do utilizador: `update public.profiles set role='admin' where id='UUID-DO-UTILIZADOR';` Se o perfil ainda não existir: `insert into public.profiles(id, role) values ('UUID-DO-UTILIZADOR','admin') on conflict(id) do update set role='admin';`

## 4. Publicar a função segura de encomendas
Instalar Supabase CLI e executar na raiz do projeto: `supabase functions deploy create-order`. A função usa `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente server-side da Edge Function. Não adicionar esta chave a `supabase-config.js`.

### 4.1 CORS da Edge Function

Configurar o secret `ALLOWED_ORIGINS` com o domínio publicado da loja, sem barra no fim. Exemplo: `https://loja.exemplo.co.mz`. Para desenvolvimento local, `localhost:3000`, `localhost:5173`, `localhost:5500` e `127.0.0.1:5500` já estão permitidos. A função não aceita origens de produção que não estejam nesta lista.

## 5. Storage
O script cria `product-images` como bucket público de leitura. Upload, atualização e remoção exigem utilizador autenticado com `profiles.role='admin'`. Organizar imagens como `products/<product-id>/front.webp`.

## 6. Pagamentos
O checkout cria encomenda com estado `pending_payment` e abre WhatsApp para o cliente anexar o comprovativo. O WhatsApp não é um gateway de pagamento: a equipa deve verificar o comprovativo e atualizar o estado para `paid` no painel/Backoffice. Não marcar automaticamente como pago.

## 7. Métricas e privacidade
Eventos first-party são enviados apenas após consentimento; não incluem nome, telefone, morada ou comprovativos. A chave pública pode inserir eventos limitados, mas apenas administradores podem consultar métricas.

## 8. Verificações antes de produção
- Configurar URL/chave pública, `ALLOWED_ORIGINS` e publicar Edge Function.
- Criar administrador e testar permissões com conta comum.
- Testar encomendas, estados, stock e falhas de rede.
- Rever textos legais, política de privacidade, entregas, trocas e contactos.
- Configurar domínio HTTPS, backups e alertas no projeto Supabase.
