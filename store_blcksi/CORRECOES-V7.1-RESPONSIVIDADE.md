# BLCKSI Store V7.1 — Responsividade global

## O que foi alterado

- Adicionado um bloco global de compatibilidade no fim de `styles/css/main.css`, preservando o sistema visual da homepage.
- Normalizados cabeçalhos antigos, navegação, ícones SVG, formulários, imagens, cartões, grelhas, rodapé, página de produto, carrinho, checkout, contacto, sobre, políticas e painel administrativo.
- Criados ajustes específicos para desktop, tablet, telemóvel e ecrãs estreitos.
- Corrigidos aliases de variáveis CSS antigas (`--text-muted`, `--border`, `--bg-card` e `--radius`) para evitar estilos sem cor/fundo.
- Adicionado `styles/js/site-ui.js` para o menu móvel das páginas internas que não carregavam `main.js`.
- Atualizada a versão de cache do `main.css` em todas as páginas para `blcksi-v71`.

## Verificações técnicas executadas

- Sintaxe JavaScript verificada com `node --check` em todos os ficheiros JS.
- CSS analisado sem erros de parsing.
- Referências locais a CSS, JS e imagens verificadas: nenhuma referência local em falta.

## Antes de publicar

A responsividade foi ajustada por CSS e validada estruturalmente. Ainda é necessário abrir o site num browser e testar visualmente em dispositivos reais ou emuladores. Funcionalidades que dependem de Supabase continuam a exigir URL/chave pública, schema e Edge Function configurados conforme `supabase/README.md`.
