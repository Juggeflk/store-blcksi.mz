# BLCKSI Store — auditoria integrada V7

## Resultado da auditoria à V5

A V5 já continha a maior parte da lógica funcional. A V6 acrescentou o redesign da homepage, mas nenhuma das versões podia ser considerada uma loja pronta para receber pagamentos reais sem configurar e testar o projeto Supabase.

## Matriz das etapas solicitadas

| Etapa / requisito | Estado no pacote V7 | Observação |
|---|---|---|
| Homepage e identidade visual BLCKSI | Implementado | Homepage editorial V6 integrada com as páginas e funções V5. |
| Layout responsivo | Parcialmente implementado | Homepage com ajustes desktop/tablet/mobile; páginas internas preservam o CSS responsivo existente, mas precisam de revisão visual final em dispositivos reais. |
| Navegação e categorias | Implementado no código | Categorias locais e carregamento de categorias ativas do Supabase; administrador pode criar e ativar/desativar categorias. |
| Catálogo de produtos | Implementado no código | Catálogo local de fallback e leitura de produtos ativos do Supabase. Produtos reais, preços e stock devem ser revistos antes de publicar. |
| Página de produto | Implementado | Página dinâmica por `slug`, variantes/tamanhos, descrição, preço e galeria. |
| Ampliação de imagens | Implementado | Galeria de produto com miniaturas, ampliação e navegação. |
| Carrinho | Implementado | Persistência local, quantidades, remoção, tamanhos e totais. Homepage inclui mini-carrinho lateral. |
| Checkout | Implementado no código | Formulário e resumo; o servidor recalcula preços com base no catálogo Supabase. |
| WhatsApp para confirmação | Implementado no código | Abre conversa com referência e resumo, para envio do comprovativo. Não é um gateway que confirma pagamentos automaticamente. |
| M-Pesa, e-Mola e transferência | Implementado como métodos selecionáveis | A confirmação é manual pela equipa no back office. Não existe integração API direta com os operadores bancários. |
| Supabase / base de dados | Estrutura incluída | `schema.sql` cria tabelas, índices, RLS e Storage. Falta executar no projeto real e configurar as chaves públicas. |
| Função segura de encomendas | Código incluído | `create-order` valida dados, consulta preços/stock no servidor e cria pedido pendente. Deve ser publicada e testada no projeto. |
| Back office | Implementado no código | Login, verificação de role admin, gestão de pedidos, produtos, categorias e métricas. |
| Segurança / RLS | Parcialmente implementado | Políticas para catálogo, pedidos, perfis, métricas e Storage. Requer teste no projeto real, proteção anti-spam/rate limit e revisão operacional antes de produção. |
| Mineração de dados / analytics | Implementado em nível inicial | Eventos anónimos com consentimento, métricas agregadas e ranking de produtos. Não é ainda um sistema avançado de previsão ou recomendação por IA. |
| Contas de clientes | Parcial | Existe estrutura Supabase Auth/perfil, mas não há uma área completa de cliente com histórico e gestão de conta. |
| Domínio, HTTPS, backups e publicação | Pendente de configuração | Dependem da conta de alojamento e do projeto Supabase do proprietário. |

## Correções integradas nesta V7

1. A homepage V6 e as funcionalidades da V5 estão no mesmo projeto, sem substituir as páginas internas.
2. A função `create-order` agora consolida linhas repetidas do mesmo produto/tamanho e valida o stock total por produto, evitando que linhas duplicadas contornem a validação individual.
3. A função usa uma lista configurável de origens CORS (`ALLOWED_ORIGINS`) em vez de aceitar qualquer origem por defeito. As origens locais comuns ficam permitidas para desenvolvimento.
4. A política de inserção de métricas limita os nomes de eventos, o tamanho e as chaves dos dados enviados.
5. O evento de checkout foi corrigido para `order_created`: criar uma encomenda pendente não significa que o pagamento foi concluído.
6. O painel de métricas passou a apresentar “Pedidos criados”, em vez de sugerir checkouts/pagamentos concluídos.

## Limitações que continuam explícitas

- Não foram adicionadas credenciais Supabase, `service_role`, passwords, tokens ou dados privados ao ZIP.
- Não foi possível criar/publicar recursos dentro da conta Supabase do proprietário.
- Não existe confirmação automática M-Pesa/e-Mola/banco; a equipa verifica o comprovativo e altera o estado para pago.
- Encomendas pendentes não reservam stock; o stock é deduzido quando a equipa confirma o pagamento. Deve existir controlo operacional para evitar vender a última unidade em pedidos simultâneos.
- A pesquisa da homepage filtra a seleção de produtos apresentada na própria homepage; não substitui ainda uma pesquisa global indexada de todo o catálogo.
- Não foi executado teste de pagamento real, nem teste de carga, nem auditoria externa de segurança.

## Como colocar a V7 a funcionar

### A. Testar a loja localmente

1. Extrair o ZIP.
2. Abrir a pasta `store_blcksi` num editor.
3. Servir a pasta por um servidor local (por exemplo, Live Server no VS Code). Não testar a função Supabase abrindo o HTML por `file://`.
4. Abrir `paginas/index.html` e testar navegação, produto, galeria, carrinho e checkout.
5. Sem Supabase configurado, o checkout deve informar que não consegue registar a encomenda no servidor; não deve afirmar que houve pedido confirmado.

### B. Ativar Supabase

1. Criar um projeto Supabase.
2. Em `styles/js/supabase-config.js`, preencher `url` e `key` com a URL do projeto e a chave pública/publishable (ou anon legacy).
3. No SQL Editor, executar o ficheiro `supabase/schema.sql` completo.
4. Criar a conta de administrador em Authentication > Users e atribuir `role='admin'` ao UUID em `public.profiles` usando o SQL indicado em `supabase/README.md`.
5. Instalar/usar Supabase CLI e publicar `supabase/functions/create-order`.
6. Configurar os secrets da Edge Function: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ALLOWED_ORIGINS` com o domínio real da loja, por exemplo `https://teu-dominio.co.mz` (substituir pelo domínio efetivo). A chave service role fica apenas no servidor.
7. Inserir produtos, preços, stock e imagens reais. Rever o contacto WhatsApp em `styles/js/checkout.js` antes de publicar.
8. Testar com uma conta cliente e uma conta admin; testar pedido, comprovativo, confirmação manual, dedução/reposição de stock e permissões.

### C. Checklist antes de produção

- [ ] URL e chave pública do Supabase configuradas.
- [ ] `schema.sql` executado sem erros.
- [ ] Administrador criado e acesso de cliente comum testado.
- [ ] Edge Function publicada e secrets configurados.
- [ ] Domínio real incluído em `ALLOWED_ORIGINS`.
- [ ] Contacto WhatsApp confirmado.
- [ ] Catálogo, preços, tamanhos, imagens e stock conferidos.
- [ ] Teste de encomenda em M-Pesa/e-Mola/transferência feito sem marcar pagamento automaticamente.
- [ ] Estado `paid` só aplicado depois da confirmação do valor recebido.
- [ ] Política de privacidade, entregas, trocas/devoluções e contactos revistos.
- [ ] HTTPS, backups, monitorização e proteção anti-spam configurados.
- [ ] Testes visuais em telemóvel, tablet e desktop concluídos.

**Conclusão:** a V7 reúne num único pacote a base V5, o redesign da homepage V6 e as correções descritas acima. Está pronta para ser extraída e testada localmente. Só fica pronta para encomendas reais depois de concluir a configuração Supabase, publicar a função e realizar os testes de produção indicados.
