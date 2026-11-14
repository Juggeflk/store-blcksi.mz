
(function () {
  'use strict';

  var cfg = window.BLCKSI_SUPABASE || {};
  var login = document.getElementById('adminLogin');
  var panel = document.getElementById('adminPanel');
  var content = document.getElementById('adminContent');
  var message = document.getElementById('loginMessage');
  var db = window.BLCKSI_CLIENT;

  if (!cfg.url || !cfg.key || !window.supabase || !db) {
    message.textContent = 'Configura primeiro a ligação ao Supabase.';
    return;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  function money(v) {
    return Number(v || 0).toLocaleString('pt-MZ') + ' MT';
  }

  function date(v) {
    return v ? new Date(v).toLocaleString('pt-MZ') : '—';
  }

  async function access() {
    var u = await db.auth.getUser();

    if (!u.data.user) return false;

    var p = await db.from('profiles')
      .select('role')
      .eq('id', u.data.user.id)
      .single();

    return !p.error && p.data.role === 'admin';
  }

  async function show() {
    if (!await access()) {
      await db.auth.signOut();
      login.hidden = false;
      panel.hidden = true;
      message.textContent =
        'Esta conta não tem permissões de administrador.';
      return;
    }

    login.hidden = true;
    panel.hidden = false;
    load('orders');
  }

  function statusName(status) {
    var names = {
      pending_payment: 'Pendente de pagamento',
      payment_review: 'Em análise',
      paid: 'Pago',
      processing: 'Em preparação',
      shipped: 'Enviado',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };

    return names[status] || status;
  }

  function renderOrder(o) {
    var locked = o.status === 'cancelled';
    var canMarkTest =
      !o.is_test &&
      ['pending_payment', 'payment_review', 'cancelled'].includes(o.status);

    return '<article class="admin-row" style="align-items:flex-start;">' +
      '<div style="flex:1;min-width:220px;">' +
        '<b>' + esc(o.order_number) + '</b>' +
        (o.is_test
          ? '<p><strong style="color:#d99b35;">DADOS DE TESTE</strong></p>'
          : '') +
        '<p>' + esc(o.customer_name) + ' · ' +
          esc(o.customer_phone) + '</p>' +
        '<small>' + date(o.created_at) +
          ' · ' + money(o.total) + '</small>' +
        '<p><small>Pagamento: ' +
          esc(o.payment_method || 'Não indicado') +
          ' · Estado: ' + esc(statusName(o.status)) +
        '</small></p>' +
      '</div>' +

      '<div style="min-width:180px;">' +
        '<select data-order="' + esc(o.id) + '"' +
          (locked ? ' disabled' : '') + '>' +
          '<option value="pending_payment">Pendente de pagamento</option>' +
          '<option value="payment_review">Em análise</option>' +
          '<option value="paid">Pago</option>' +
          '<option value="processing">Em preparação</option>' +
          '<option value="shipped">Enviado</option>' +
          '<option value="completed">Concluído</option>' +
          '<option value="cancelled">Cancelado</option>' +
        '</select>' +
        '<button data-save-order="' + esc(o.id) + '"' +
          (locked ? ' disabled' : '') + '>GUARDAR</button>' +
        (canMarkTest
          ? '<button type="button" data-mark-test="' + esc(o.id) +
            '" style="margin-top:6px;">MARCAR COMO TESTE</button>'
          : '') +
        (locked
          ? '<small>Encomenda cancelada e bloqueada.</small>'
          : '') +
      '</div>' +
    '</article>';
  }

  async function orderDetails(order) {
    var items = await db.from('order_items')
      .select('product_name,product_slug,size,quantity,unit_price,line_total')
      .eq('order_id', order.id);

    if (items.error) {
      alert('Erro ao carregar artigos: ' + items.error.message);
      return;
    }

    var list = (items.data || []).map(function (item) {
      return '<p class="admin-row">' +
        '<span><b>' + esc(item.product_name) + '</b>' +
        '<small>' + esc(item.product_slug || '') +
        (item.size ? ' · Tamanho: ' + esc(item.size) : '') +
        ' · Quantidade: ' + Number(item.quantity) +
        '</small></span>' +
        '<strong>' + money(item.line_total) + '</strong>' +
      '</p>';
    }).join('');

    var box = document.getElementById('orderSearchResult');

    box.innerHTML =
      '<article class="admin-table">' +
        '<h2>DETALHES DA ENCOMENDA</h2>' +
        '<p><b>Referência:</b> ' + esc(order.order_number) + '</p>' +
        '<p><b>Cliente:</b> ' + esc(order.customer_name) + '</p>' +
        '<p><b>Contacto:</b> ' + esc(order.customer_phone) + '</p>' +
        '<p><b>Entrega:</b> ' + esc(order.delivery_address || '—') + '</p>' +
        '<p><b>Data:</b> ' + date(order.created_at) + '</p>' +
        '<p><b>Método:</b> ' + esc(order.payment_method || '—') + '</p>' +
        '<p><b>Referência de pagamento:</b> ' +
          esc(order.payment_reference || 'Não registada') + '</p>' +
        '<p><b>Estado:</b> ' + esc(statusName(order.status)) + '</p>' +
        '<p><b>Total da encomenda:</b> <strong>' +
          money(order.total) + '</strong></p>' +
        '<p><b>Estado do recebimento:</b> ' +
          (['paid', 'processing', 'shipped', 'completed'].includes(order.status)
            ? 'Pagamento registado como confirmado'
            : 'Pagamento ainda não confirmado') +
        '</p>' +
        '<p class="cart-small">O total da encomenda não comprova, por si só, o valor efetivamente recebido.</p>' +
        '<h3>PRODUTOS</h3>' +
        (list || '<p>Sem artigos registados.</p>') +
        (order.notes
          ? '<h3>NOTAS</h3><p>' + esc(order.notes) + '</p>'
          : '') +
      '</article>';
  }

  async function searchOrder(reference) {
    var box = document.getElementById('orderSearchResult');
    var term = String(reference || '').trim();

    if (!term) {
      box.textContent = 'Introduz o código de referência.';
      return;
    }

    box.textContent = 'A pesquisar encomenda...';

    var result = await db.from('orders')
      .select(
        'id,order_number,customer_name,customer_phone,' +
        'delivery_address,total,status,created_at,payment_method,' +
        'payment_reference,notes,is_test'
      )
      .ilike('order_number', '%' + term + '%')
      .limit(10);

    if (result.error) {
      box.textContent = 'Erro na pesquisa: ' + result.error.message;
      return;
    }

    if (!result.data || !result.data.length) {
      box.textContent = 'Nenhuma encomenda encontrada com essa referência.';
      return;
    }

    if (result.data.length > 1) {
      box.innerHTML =
        '<h3>FORAM ENCONTRADAS VÁRIAS ENCOMENDAS</h3>' +
        result.data.map(function (o) {
          return '<button type="button" data-open-order="' +
            esc(o.id) + '">' + esc(o.order_number) + '</button>';
        }).join(' ');

      box.querySelectorAll('[data-open-order]').forEach(function (b) {
        b.onclick = function () {
          var order = result.data.find(function (o) {
            return o.id === b.dataset.openOrder;
          });
          if (order) orderDetails(order);
        };
      });

      return;
    }

    await orderDetails(result.data[0]);
  }

  async function load(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'metrics') {
      var ev = await db.from('analytics_events')
        .select('event_name,properties,occurred_at,is_test')
        .order('occurred_at', { ascending: false })
        .limit(2000);

      var ord = await db.from('orders')
        .select('id,total,status,created_at,is_test')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (ev.error || ord.error) {
        content.textContent = (ev.error || ord.error).message;
        return;
      }

      var events = ev.data || [];
      var orders = ord.data || [];
      var views = {};
      var adds = {};

      function count(n) {
        return events.filter(function (e) {
          return e.event_name === n;
        }).length;
      }

      events.forEach(function (e) {
        var slug = e.properties && e.properties.slug;

        if (slug && e.event_name === 'product_view') {
          views[slug] = (views[slug] || 0) + 1;
        }

        if (slug && e.event_name === 'add_to_cart') {
          adds[slug] = (adds[slug] || 0) + 1;
        }
      });

      var top = Object.keys(views)
        .sort(function (a, b) {
          return views[b] - views[a];
        })
        .slice(0, 8);

      var paid = orders.filter(function (o) {
        return ['paid', 'processing', 'shipped', 'completed']
          .includes(o.status);
      });

      var revenue = paid.reduce(function (n, o) {
        return n + Number(o.total || 0);
      }, 0);

      var testOrders = orders.filter(function (o) {
        return o.is_test;
      }).length;

      var testEvents = events.filter(function (e) {
        return e.is_test;
      }).length;

      content.innerHTML =
        '<h2>VISÃO GERAL</h2>' +
        '<div class="metric-grid">' +
          '<article><small>ENCOMENDAS</small><strong>' +
            orders.length + '</strong></article>' +
          '<article><small>VENDAS CONFIRMADAS</small><strong>' +
            money(revenue) + '</strong></article>' +
          '<article><small>VISUALIZAÇÕES DE PRODUTO</small><strong>' +
            count('product_view') + '</strong></article>' +
          '<article><small>ADIÇÕES AO CARRINHO</small><strong>' +
            count('add_to_cart') + '</strong></article>' +
          '<article><small>PEDIDOS CRIADOS</small><strong>' +
            count('order_created') + '</strong></article>' +
        '</div>' +

        '<h2>PRODUTOS MAIS VISUALIZADOS</h2>' +
        '<div class="admin-table">' +
          (top.length
            ? top.map(function (slug) {
                return '<p class="admin-row"><b>' + esc(slug) +
                  '</b><span>' + views[slug] +
                  ' visualizações · ' + (adds[slug] || 0) +
                  ' adições ao carrinho</span></p>';
              }).join('')
            : '<p class="cart-small">Ainda não existem eventos suficientes para gerar tendências.</p>') +
        '</div>' +

        '<h2>LIMPEZA DE DADOS DE TESTE</h2>' +
        '<p>Encomendas identificadas como teste: <b>' +
          testOrders + '</b></p>' +
        '<p>Eventos identificados como teste: <b>' +
          testEvents + '</b></p>' +
        '<p class="cart-small">A limpeza não apaga produtos, categorias, stock ou encomendas reais.</p>' +
        '<button type="button" id="resetTestData">LIMPAR DADOS DE TESTE</button>' +

        '<p class="cart-small">A amostra limita-se aos últimos 2.000 eventos e 1.000 pedidos.</p>';

      document.getElementById('resetTestData').onclick = async function () {
        if (!confirm(
          'ATENÇÃO: serão apagadas todas as encomendas e métricas identificadas como teste. Os produtos e encomendas reais serão preservados. Continuar?'
        )) return;

        if (!confirm('Confirma novamente que queres apagar os dados de teste?')) {
          return;
        }

        this.disabled = true;
        this.textContent = 'A LIMPAR...';

        var result = await db.rpc('admin_reset_test_data');

        if (result.error) {
          alert('Erro ao limpar dados: ' + result.error.message);
          this.disabled = false;
          this.textContent = 'LIMPAR DADOS DE TESTE';
          return;
        }

        var d = result.data || {};

        alert(
          'Limpeza concluída.\n' +
          'Encomendas apagadas: ' + (d.orders_deleted || 0) + '\n' +
          'Artigos apagados: ' + (d.items_deleted || 0) + '\n' +
          'Reservas apagadas: ' + (d.reservations_deleted || 0) + '\n' +
          'Eventos apagados: ' + (d.events_deleted || 0)
        );

        load('metrics');
      };

      return;
    }

    if (tab === 'orders') {
      var r = await db.from('orders')
        .select(
          'id,order_number,customer_name,customer_phone,total,' +
          'status,created_at,is_test,payment_method'
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (r.error) {
        content.textContent = r.error.message;
        return;
      }

      content.innerHTML =
        '<h2>PESQUISAR ENCOMENDA</h2>' +
        '<form id="orderSearchForm" class="admin-form">' +
          '<input name="reference" placeholder="Código de referência da encomenda" required>' +
          '<button type="submit" class="btn btn-light">PESQUISAR</button>' +
        '</form>' +
        '<div id="orderSearchResult"></div>' +
        '<h2>ENCOMENDAS RECENTES</h2>' +
        '<div class="admin-table">' +
          ((r.data || []).map(renderOrder).join('') ||
            '<p>Não existem encomendas.</p>') +
        '</div>';

      document.getElementById('orderSearchForm').onsubmit = function (e) {
        e.preventDefault();
        var d = new FormData(e.target);
        searchOrder(d.get('reference'));
      };

      r.data.forEach(function (o) {
        var s = content.querySelector('[data-order="' + o.id + '"]');
        if (s) s.value = o.status;
      });

      content.querySelectorAll('[data-mark-test]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.dataset.markTest;

          if (!confirm(
            'Confirmas que esta encomenda é exclusivamente de teste? Esta identificação permitirá apagá-la no reset.'
          )) return;

          var result = await db.from('orders')
            .update({ is_test: true })
            .eq('id', id)
            .in('status', [
              'pending_payment',
              'payment_review',
              'cancelled'
            ]);

          if (result.error) {
            alert('Não foi possível identificar como teste: ' +
              result.error.message);
            return;
          }

          alert('Encomenda identificada como teste.');
          load('orders');
        };
      });

      content.querySelectorAll('[data-save-order]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.dataset.saveOrder;
          var select = content.querySelector('[data-order="' + id + '"]');

          if (!select || select.disabled) return;

          var status = select.value;
          var order = r.data.find(function (o) {
            return o.id === id;
          });

          if (!order) return;

          if (order.status === 'cancelled') {
            alert('Esta encomenda já foi cancelada e não pode ser reativada.');
            load('orders');
            return;
          }

          if (status === order.status) {
            alert('Não alteraste o estado desta encomenda.');
            return;
          }

          var x;

          if (status === 'paid') {
            if (!confirm(
              'Confirmaste manualmente o comprovativo e o valor recebido?'
            )) return;

            x = await db.rpc('confirm_order_payment', {
              p_order_id: id
            });

          } else if (status === 'cancelled') {
            if (!confirm(
              'Tens a certeza de que queres cancelar esta encomenda e libertar o stock reservado?'
            )) return;

            x = await db.rpc('cancel_order_and_release_stock', {
              p_order_id: id
            });

          } else {
            x = await db.from('orders')
              .update({
                status: status,
                updated_at: new Date().toISOString()
              })
              .eq('id', id);
          }

          if (x.error) {
            alert('Não foi possível atualizar a encomenda: ' +
              x.error.message);
            return;
          }

          alert('Encomenda atualizada com sucesso.');
          load('orders');
        };
      });

      return;
    }

    if (tab === 'categories') {
      content.innerHTML =
        '<h2>ADICIONAR CATEGORIA</h2>' +
        '<form id="categoryForm" class="admin-form">' +
          '<input name="name" placeholder="Nome da categoria" required>' +
          '<input name="slug" placeholder="slug-exemplo" required>' +
          '<input name="description" placeholder="Descrição">' +
          '<button class="btn btn-light">CRIAR CATEGORIA</button>' +
        '</form>' +
        '<div id="categoryList"></div>';

      var r = await db.from('categories')
        .select('*')
        .order('position');

      if (r.error) {
        content.textContent = r.error.message;
        return;
      }

      document.getElementById('categoryList').innerHTML =
        (r.data || []).map(function (c) {
          return '<p class="admin-row">' + esc(c.name) +
            ' <small>/' + esc(c.slug) + '</small> ' +
            '<button data-cat="' + c.id + '" data-active="' +
            c.is_active + '">' +
            (c.is_active ? 'DESATIVAR' : 'ATIVAR') +
            '</button></p>';
        }).join('');

      document.getElementById('categoryForm').onsubmit =
        async function (e) {
          e.preventDefault();
          var d = new FormData(e.target);

          var x = await db.from('categories').insert({
            name: d.get('name'),
            slug: d.get('slug').toLowerCase().trim(),
            description: d.get('description'),
            position: (r.data || []).length
          });

          if (x.error) alert(x.error.message);
          else load('categories');
        };

      content.querySelectorAll('[data-cat]').forEach(function (b) {
        b.onclick = async function () {
          var x = await db.from('categories')
            .update({ is_active: b.dataset.active !== 'true' })
            .eq('id', b.dataset.cat);

          if (x.error) alert(x.error.message);
          else load('categories');
        };
      });

      return;
    }

    if (tab === 'products') {
      var cats = await db.from('categories')
        .select('id,name')
        .order('name');

      var ps = await db.from('products')
        .select('name,slug,price,stock,is_active,categories(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (cats.error || ps.error) {
        content.textContent = (cats.error || ps.error).message;
        return;
      }

      content.innerHTML =
        '<h2>ADICIONAR PRODUTO</h2>' +
        '<form id="productForm" class="admin-form">' +
          '<input name="name" placeholder="Nome" required>' +
          '<input name="slug" placeholder="slug-produto" required>' +
          '<select name="category_id">' +
            '<option value="">Sem categoria</option>' +
            (cats.data || []).map(function (c) {
              return '<option value="' + c.id + '">' +
                esc(c.name) + '</option>';
            }).join('') +
          '</select>' +
          '<input name="price" type="number" min="0" step="0.01" placeholder="Preço em MT" required>' +
          '<input name="stock" type="number" min="0" step="1" placeholder="Stock" value="0" required>' +
          '<textarea name="description" placeholder="Descrição"></textarea>' +
          '<input name="image_url" type="url" placeholder="URL da imagem principal">' +
          '<button class="btn btn-light">CRIAR PRODUTO</button>' +
        '</form>' +
        '<h2>CATÁLOGO</h2>' +
        '<div class="admin-table">' +
          (ps.data || []).map(function (p) {
            return '<p class="admin-row"><span><b>' +
              esc(p.name) + '</b><small> / ' +
              esc(p.slug) + ' · ' + money(p.price) +
              ' · stock ' + p.stock + '</small></span>' +
              '<button data-product-toggle="' + esc(p.slug) +
              '" data-active="' + p.is_active + '">' +
              (p.is_active ? 'DESATIVAR' : 'ATIVAR') +
              '</button></p>';
          }).join('') +
        '</div>';

      content.querySelectorAll('[data-product-toggle]').forEach(function (b) {
        b.onclick = async function () {
          var x = await db.from('products')
            .update({ is_active: b.dataset.active !== 'true' })
            .eq('slug', b.dataset.productToggle);

          if (x.error) alert(x.error.message);
          else load('products');
        };
      });

      document.getElementById('productForm').onsubmit =
        async function (e) {
          e.preventDefault();
          var d = new FormData(e.target);

          var payload = {
            name: d.get('name'),
            slug: d.get('slug').toLowerCase().trim(),
            category_id: d.get('category_id') || null,
            price: Number(d.get('price')),
            stock: Number(d.get('stock')),
            description: d.get('description'),
            is_active: true
          };

          var x = await db.from('products')
            .insert(payload)
            .select('id')
            .single();

          if (x.error) {
            alert(x.error.message);
            return;
          }

          if (d.get('image_url')) {
            var im = await db.from('product_images').insert({
              product_id: x.data.id,
              image_url: d.get('image_url'),
              position: 0
            });

            if (im.error) {
              alert('Produto criado, mas a imagem não foi associada: ' +
                im.error.message);
            }
          }

          load('products');
        };
    }
  }

  document.getElementById('loginForm').onsubmit =
    async function (e) {
      e.preventDefault();
      var d = new FormData(e.target);

      var r = await db.auth.signInWithPassword({
        email: d.get('email'),
        password: d.get('password')
      });

      if (r.error) {
        message.textContent = 'Credenciais inválidas ou erro de ligação.';
        return;
      }

      show();
    };

  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.onclick = function () {
      load(b.dataset.tab);
    };
  });

  document.getElementById('adminLogout').onclick = async function () {
    await db.auth.signOut();
    show();
  };

  db.auth.getSession().then(function (r) {
    if (r.data.session) show();
  });
})();
