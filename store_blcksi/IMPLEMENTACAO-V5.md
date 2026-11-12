# BLCKSI Store — relatório de implementação V5

## Funcionalidades preservadas das versões anteriores

1. Estrutura visual da loja e navegação responsiva.
2. Catálogo com fallback local e leitura dinâmica de produtos/categorias no Supabase.
3. Página de produto carregada por `slug`, com nome, categoria, descrição, preço e galeria.
4. Galeria com miniaturas, ampliação, navegação por imagens e suporte a teclado.
5. Estrutura do Storage `product-images` e tabela `product_images` para ordenar as imagens.
6. Possibilidade de adicionar categorias pelo back office quando o Supabase estiver configurado.

## Implementado nesta V5

### 1. Carrinho
- Adicionar produto a partir da página de produto.
- Guardar tamanho selecionado como variante do item.
- Aumentar e diminuir quantidades.
- Remover itens individualmente.
- Calcular subtotal e total.
- Persistir o carrinho no navegador com `localStorage`.
- Atualizar o contador do carrinho nas páginas que exibem o ícone.
- Página própria `paginas/carrinho.html`.

### 2. Checkout e WhatsApp
- Página `paginas/checkout.html` com nome, contacto, local de entrega, notas e método de pagamento.
- Resumo detalhado de itens e total.
- Métodos: M-Pesa, e-Mola e transferência bancária.
- Criar pedido através da Edge Function `create-order`.
- Gerar referência de pedido e abrir conversa WhatsApp com o resumo.
- Pedido criado com estado `pending_payment`.
- O cliente é instruído a anexar o comprovativo no WhatsApp.
- Não existe falsa confirmação automática: o pedido só passa a pago depois de validação manual pela equipa.

### 3. Supabase e dados
- Tabelas `orders`, `order_items` e `analytics_events`.
- Edge Function com validação de dados, consulta de preço/stock no servidor e criação de encomendas.
- Perfil criado automaticamente para novas contas Auth com role inicial `customer`.
- Políticas RLS para leitura pública apenas de catálogo ativo e gestão por administradores.
- O cliente não pode alterar o próprio role.
- Bucket `product-images`, público apenas para leitura e com upload/alteração reservado a administradores.
- Stock deduzido quando a equipa marca um pedido como `paid`; stock reposto em cancelamento/reembolso após pagamento.

### 4. Back office
- Página `paginas/admin.html` com autenticação Supabase.
- Verificação do role `admin` antes de mostrar dados de administração.
- Listar encomendas recentes e atualizar o estado.
- Criar categorias e ativar/desativar categorias.
- Criar produtos com preço, stock, categoria, descrição e URL da imagem.
- Ativar/desativar produtos.
- Acesso protegido pelas políticas RLS do banco de dados.

### 5. Métricas / mineração de dados
- Recolha opcional de eventos anónimos após consentimento.
- Eventos: `page_view`, `product_view`, `add_to_cart` e `checkout_completed`.
- Painel com total de encomendas, vendas confirmadas, visualizações, adições ao carrinho e checkouts registados.
- Ranking dos produtos mais visualizados e respetivas adições ao carrinho.
- Não recolhe nome, telefone, morada nem comprovativos nas métricas.

### 6. Testes técnicos realizados nesta entrega
- Verificação sintática de todos os ficheiros JavaScript do frontend com `node --check`.
- Verificação de existência dos recursos locais referenciados nas páginas HTML.
- Leitura/parsing de todas as 23 páginas HTML.

## Configuração ainda necessária antes de produção

Esta entrega contém o código e as migrações, mas não pode ativar um projeto Supabase sem as credenciais e ações do proprietário:

1. Configurar URL e chave pública em `styles/js/supabase-config.js`.
2. Executar `supabase/schema.sql` no SQL Editor.
3. Criar conta Auth para o administrador e atribuir `role='admin'` ao respetivo UUID conforme `supabase/README.md`.
4. Publicar `supabase/functions/create-order/index.ts` como Edge Function `create-order`.
5. Inserir os produtos, preços, stock e URLs de imagens reais.
6. Testar um pedido real, o recebimento do comprovativo e a confirmação manual do pagamento.
7. Configurar domínio HTTPS, política de privacidade, entregas, trocas/devoluções, backups e monitorização.

## Limites importantes

- WhatsApp é o canal de comunicação e envio do comprovativo, não um gateway que confirma pagamentos automaticamente.
- O ZIP não inclui credenciais Supabase nem chaves secretas.
- Sem Supabase configurado e Edge Function publicada, a loja navega em modo local, mas não regista encomendas reais no servidor.
- A confirmação de pagamento continua manual para evitar marcar transferências não verificadas como pagas.
