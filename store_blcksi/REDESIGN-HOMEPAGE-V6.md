# BLCKSI Store — Homepage V6

## Âmbito desta entrega
Redesign da homepage e da sua camada visual/interativa, preservando a arquitetura HTML/CSS/JavaScript existente e mantendo a integração Supabase desacoplada do redesign.

## Implementado
- Nova homepage editorial com identidade streetwear monocromática, acento verde-lima e fotografia de campanha já presente nos assets do projeto.
- Navbar responsiva com menu mobile acessível, pesquisa e acesso ao carrinho.
- Hero de marca com CTA para lançamentos e coleções.
- Faixa de manifesto da marca.
- Secção de lançamentos ligada ao renderer de produtos existente e ao fallback/Supabase já preparado.
- Secção de categorias compatível com categorias locais e categorias carregadas do Supabase.
- Bloco editorial de coleção e manifesto BLCKSI.
- Footer reorganizado com navegação e apoio.
- Mini-carrinho lateral: lista itens, tamanhos, quantidades, remoção, subtotal e ligação para checkout/carrinho.
- Painel de pesquisa que filtra os produtos apresentados na seleção inicial da homepage.
- Estados de foco, aria labels, fecho por ESC e backdrop para os painéis.
- Ajustes mobile/tablet/desktop e suporte a `prefers-reduced-motion`.
- Interações da homepage isoladas em `styles/js/home-ui.js`.

## Ficheiros alterados
- `paginas/index.html`
- `styles/css/main.css`
- `styles/js/main.js` (remoção dos handlers antigos duplicados do menu mobile)
- `styles/js/store-data.js` (fallback local da seleção inicial com produtos/preços reais do catálogo local)
- `styles/js/produto.js` (fallback dos quatro produtos iniciais alinhado com os slugs, nomes, preços e imagens da homepage)

## Ficheiro novo
- `styles/js/home-ui.js`

## Verificações efetuadas
- Sintaxe JavaScript validada com `node --check` para os ficheiros JS do projeto.
- HTML da homepage analisado: sem IDs duplicados.
- Referências locais de scripts verificadas.
- Ligações locais de navegação da homepage verificadas.
- Assets usados no fallback da homepage confirmados no pacote.

## Ainda não faz parte desta fase
- Ligação de credenciais reais do Supabase.
- Alteração visual das páginas internas de categoria, produto, carrinho, checkout e administração.
- Testes de pagamento reais e publicação em produção.
