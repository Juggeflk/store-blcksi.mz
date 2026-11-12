# BLCKSI Store V7

Pacote integrado da loja BLCKSI: homepage editorial V6 + catálogo, páginas internas, galeria de produto, carrinho, checkout por WhatsApp, back office, estrutura Supabase, políticas RLS e métricas anónimas.

## Começar

- Abrir `paginas/index.html` através de um servidor local (ex.: Live Server no VS Code).
- Para pedidos reais, configurar Supabase e publicar a Edge Function `create-order` conforme `supabase/README.md`.
- Nunca colocar a chave `service_role` no frontend.

## Documentação

- `AUDITORIA-ETAPAS-V7.md` — matriz das etapas, estado real, limitações e checklist antes do lançamento.
- `IMPLEMENTACAO-V5.md` — descrição da base funcional V5.
- `REDESIGN-HOMEPAGE-V6.md` — descrição do redesign da homepage.
- `supabase/README.md` — configuração da base de dados, Auth, Storage e Edge Function.

**Importante:** o checkout abre WhatsApp para o cliente enviar o comprovativo. O pagamento é confirmado manualmente pela equipa. O pacote não contém credenciais nem está ligado a uma conta Supabase real.
