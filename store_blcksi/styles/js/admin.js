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
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function money(v) {
    return Number(v || 0).toLocaleString('pt-MZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' MT';
  }

  function date(v) {
    return v ? new Date(v).toLocaleString('pt-MZ') : '—';
  }

  function receivedStatus(order) {
    var total = Number(order.total || 0);
    var received = Number(order.amount_paid || 0);
    if (received >= total && total > 0) return 'Pagamento integralmente recebido';
    if (received > 0) return 'Pagamento parcial';
    return 'Pagamento não confirmado';
  }

  function methodName(v) {
    var s = String(v || '').toLowerCase().replace(/[\s_-]/g, '');
    if (s.indexOf('mpesa') >= 0) return 'M-Pesa';
    if (s.indexOf('emola') >= 0) return 'e-Mola';
    return v || 'Não indicado';
  }

  function isMpesa(v) {
    return String(v || '').toLowerCase().replace(/[\s_-]/g, '').indexOf('mpesa') >= 0;
  }

  function isEmola(v) {
    return String(v || '').toLowerCase().replace(/[\s_-]/g, '').indexOf('emola') >= 0;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function startOfWeek(d) {
    var x = startOfDay(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
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

  async function access() {
    var u = await db.auth.getUser();
    if (u.error) return { ok: false, message: 'Não foi possível validar a sessão: ' + u.error.message };
    if (!u.data.user) return { ok: false, message: 'Sessão não encontrada. Volta a entrar no painel.' };

    var p = await db.from('profiles')
      .select('role')
      .eq('id', u.data.user.id)
      .maybeSingle();

    if (p.error) {
      return { ok: false, message: 'A sessão foi iniciada, mas não foi possível consultar o perfil de administrador (' + p.error.code + '): ' + p.error.message };
    }
    if (!p.data) return { ok: false, message: 'A conta está autenticada, mas não existe um perfil correspondente na tabela profiles.' };
    if (p.data.role !== 'admin') return { ok: false, message: 'Esta conta não tem permissões de administrador.' };
    return { ok: true };
  }

  async function show() {
    try {
      var result = await access();
      if (!result.ok) {
        login.hidden = false;
        panel.hidden = true;
        message.textContent = result.message;
        return;
      }

      message.textContent = '';
      login.hidden = true;
      panel.hidden = false;
      await load('orders');
    } catch (err) {
      login.hidden = false;
      panel.hidden = true;
      message.textContent = 'A autenticação foi iniciada, mas ocorreu um erro ao validar ou carregar o painel: ' + (err && err.message ? err.message : String(err));
      console.error('BLCKSI admin panel error:', err);
    }
  }

  function renderOrder(o) {
    var locked = o.status === 'cancelled';
    var canMarkTest = !o.is_test &&
      ['pending_payment', 'payment_review', 'cancelled'].includes(o.status);
    var canCancel = ['pending_payment', 'payment_review', 'processing'].includes(o.status) && Number(o.amount_paid || 0) === 0;

    return '<article class="admin-row" style="align-items:flex-start;">' +
      '<div style="flex:1;min-width:220px;">' +
      '<b>' + esc(o.order_number) + '</b>' +
      (o.is_test ? '<p><strong style="color:#d99b35;">DADOS DE TESTE</strong></p>' : '') +
      '<p>' + esc(o.customer_name) + ' · ' + esc(o.customer_phone) + '</p>' +
      '<small>' + date(o.created_at) + ' · Total: ' + money(o.total) + '</small>' +
      '<p><small>Recebido: <strong>' + money(o.amount_paid) + '</strong></small></p>' +
      '<p><small>Pagamento: ' + esc(methodName(o.payment_method)) +
      ' · Estado: ' + esc(statusName(o.status)) + '</small></p>' +
      '</div><div style="min-width:180px;">' +
      '<select data-order="' + esc(o.id) + '"' + (locked ? ' disabled' : '') + '>' +
      '<option value="pending_payment">Pendente de pagamento</option>' +
      '<option value="payment_review">Em análise</option>' +
      '<option value="paid">Pago</option>' +
      '<option value="processing">Em preparação</option>' +
      '<option value="shipped">Enviado</option>' +
      '<option value="completed">Concluído</option>' +
      '<option value="cancelled">Cancelado</option></select>' +
      '<button data-save-order="' + esc(o.id) + '"' + (locked ? ' disabled' : '') + '>GUARDAR</button>' +
      (canCancel ? '<button type="button" data-cancel-order="' + esc(o.id) + '" style="margin-top:6px;background:#8b2525;color:#fff;">CANCELAR ENCOMENDA E LIBERTAR STOCK</button>' : '') +
      (canMarkTest ? '<button type="button" data-mark-test="' + esc(o.id) +
      '" style="margin-top:6px;">MARCAR COMO TESTE</button>' : '') +
      (locked ? '<small>Encomenda cancelada e bloqueada.</small>' : '') +
      '</div></article>';
  }

  async function orderDetails(order) {
    var items = await db.from('order_items')
      .select('product_name,product_slug,size,color,quantity,unit_price,line_total')
      .eq('order_id', order.id);

    if (items.error) {
      alert('Erro ao carregar artigos: ' + items.error.message);
      return;
    }

    var list = (items.data || []).map(function (item) {
      return '<p class="admin-row"><span><b>' + esc(item.product_name) +
        '</b><small>' + esc(item.product_slug || '') +
        (item.size ? ' · Tamanho: ' + esc(item.size) : '') +
        (item.color ? ' · Cor: ' + esc(item.color) : '') +
        ' · Quantidade: ' + Number(item.quantity) +
        ' · Unitário: ' + money(item.unit_price) +
        '</small></span><strong>' + money(item.line_total) + '</strong></p>';
    }).join('');

    var total = Number(order.total || 0);
    var received = Number(order.amount_paid || 0);
    var remaining = Math.max(total - received, 0);
    var box = document.getElementById('orderSearchResult');

    box.innerHTML = '<article class="admin-table">' +
      '<h2>DETALHES DA ENCOMENDA</h2>' +
      '<p><b>Referência:</b> ' + esc(order.order_number) + '</p>' +
      '<p><b>Cliente:</b> ' + esc(order.customer_name) + '</p>' +
      '<p><b>Contacto:</b> ' + esc(order.customer_phone) + '</p>' +
      '<p><b>Entrega:</b> ' + esc(order.delivery_address || '—') + '</p>' +
      '<p><b>Data:</b> ' + date(order.created_at) + '</p>' +
      '<p><b>Método:</b> ' + esc(methodName(order.payment_method)) + '</p>' +
      '<p><b>Referência de pagamento:</b> ' + esc(order.payment_reference || 'Não registada') + '</p>' +
      '<p><b>Estado da encomenda:</b> ' + esc(statusName(order.status)) + '</p>' +
      '<hr><p><b>Total da encomenda:</b> <strong>' + money(total) + '</strong></p>' +
      '<p><b>Valor efetivamente recebido:</b> <strong>' + money(received) + '</strong></p>' +
      '<p><b>Valor ainda por receber:</b> <strong>' + money(remaining) + '</strong></p>' +
      '<p><b>Estado do recebimento:</b> ' + esc(receivedStatus(order)) + '</p>' +
      '<p class="cart-small">O valor recebido só é atualizado pela confirmação manual do pagamento. Uma encomenda guardada não representa dinheiro recebido.</p>' +
      '<h3>PRODUTOS</h3>' + (list || '<p>Sem artigos registados.</p>') +
      (order.notes ? '<h3>NOTAS</h3><p>' + esc(order.notes) + '</p>' : '') +
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
      .select('id,order_number,customer_name,customer_phone,delivery_address,total,amount_paid,status,created_at,payment_method,payment_reference,notes,is_test')
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
      box.innerHTML = '<h3>FORAM ENCONTRADAS VÁRIAS ENCOMENDAS</h3>' +
        result.data.map(function (o) {
          return '<button type="button" data-open-order="' + esc(o.id) + '">' +
            esc(o.order_number) + '</button>';
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

  async function loadPayments() {
    content.innerHTML = '<h2>HISTÓRICO DE PAGAMENTOS</h2><p>A carregar...</p>';

    var result = await db.from('payment_history')
      .select('id,order_id,order_number,amount,currency,payment_method,payment_reference,confirmed_at,confirmed_by')
      .order('confirmed_at', { ascending: false })
      .limit(1000);

    if (result.error) {
      content.innerHTML = '<h2>HISTÓRICO DE PAGAMENTOS</h2><p>Erro: ' +
        esc(result.error.message) + '</p>';
      return;
    }

    var payments = result.data || [];
    var now = new Date();
    var day = startOfDay(now);
    var week = startOfWeek(now);
    var month = startOfMonth(now);

    function sumSince(start, method) {
      return payments.reduce(function (sum, p) {
        var d = new Date(p.confirmed_at);
        var matchesMethod = !method ||
          (method === 'mpesa' && isMpesa(p.payment_method)) ||
          (method === 'emola' && isEmola(p.payment_method));

        return d >= start && d <= now && matchesMethod
          ? sum + Number(p.amount || 0) : sum;
      }, 0);
    }

    var today = sumSince(day);
    var thisWeek = sumSince(week);
    var thisMonth = sumSince(month);
    var mpesa = payments.reduce(function (s, p) {
      return s + (isMpesa(p.payment_method) ? Number(p.amount || 0) : 0);
    }, 0);
    var emola = payments.reduce(function (s, p) {
      return s + (isEmola(p.payment_method) ? Number(p.amount || 0) : 0);
    }, 0);
    var total = payments.reduce(function (s, p) {
      return s + Number(p.amount || 0);
    }, 0);

    content.innerHTML =
      '<h2>HISTÓRICO DE PAGAMENTOS</h2>' +
      '<div class="metric-grid">' +
      '<article><small>TOTAL RECEBIDO</small><strong>' + money(total) + '</strong></article>' +
      '<article><small>RECEBIDO HOJE</small><strong>' + money(today) + '</strong></article>' +
      '<article><small>ESTA SEMANA</small><strong>' + money(thisWeek) + '</strong></article>' +
      '<article><small>ESTE MÊS</small><strong>' + money(thisMonth) + '</strong></article>' +
      '<article><small>TOTAL M-PESA</small><strong>' + money(mpesa) + '</strong></article>' +
      '<article><small>TOTAL E-MOLA</small><strong>' + money(emola) + '</strong></article>' +
      '</div>' +
      '<h3>REGISTOS DE PAGAMENTO (' + payments.length + ')</h3>' +
      '<div class="admin-table">' +
      (payments.length ? payments.map(function (p) {
        return '<article class="admin-row" style="align-items:flex-start;">' +
          '<div style="flex:1;min-width:220px;">' +
          '<b>' + esc(p.order_number) + '</b>' +
          '<p>' + esc(methodName(p.payment_method)) + ' · ' +
          esc(p.payment_reference || 'Sem referência') + '</p>' +
          '<small>Confirmado: ' + date(p.confirmed_at) + '</small>' +
          '</div><strong>' + money(p.amount) + '</strong></article>';
      }).join('') : '<p class="cart-small">Ainda não existem pagamentos confirmados.</p>') +
      '</div>' +
      '<p class="cart-small">Relatório calculado com os últimos 1.000 registos de pagamento.</p>';

  }

  async function load(tab) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'payments') {
      await loadPayments();
      return;
    }

    if (tab === 'metrics') {
      var ev = await db.from('analytics_events')
        .select('event_name,properties,occurred_at,is_test')
        .order('occurred_at', { ascending: false })
        .limit(2000);

      var ord = await db.from('orders')
        .select('id,total,amount_paid,status,created_at,is_test')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (ev.error || ord.error) {
        content.textContent = (ev.error || ord.error).message;
        return;
      }

      var events = (ev.data || []).filter(function (e) {
        return !e.is_test;
      });
      var orders = ord.data || [];
      var realOrders = orders.filter(function (o) {
        return !o.is_test;
      });

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

      var top = Object.keys(views).sort(function (a, b) {
        return views[b] - views[a];
      }).slice(0, 8);

      var orderedValue = realOrders.reduce(function (n, o) {
        return n + Number(o.total || 0);
      }, 0);
      var revenue = realOrders.reduce(function (n, o) {
        return n + Number(o.amount_paid || 0);
      }, 0);
      var testOrders = orders.filter(function (o) {
        return o.is_test;
      }).length;
      var testEvents = (ev.data || []).filter(function (e) {
        return e.is_test;
      }).length;

      content.innerHTML =
        '<h2>VISÃO GERAL</h2>' +
        '<div class="metric-grid">' +
        '<article><small>ENCOMENDAS</small><strong>' + realOrders.length + '</strong></article>' +
        '<article><small>VALOR ENCOMENDADO</small><strong>' + money(orderedValue) + '</strong></article>' +
        '<article><small>VALOR EFETIVAMENTE RECEBIDO</small><strong>' + money(revenue) + '</strong></article>' +
        '<article><small>VISUALIZAÇÕES DE PRODUTO</small><strong>' + count('product_view') + '</strong></article>' +
        '<article><small>ADIÇÕES AO CARRINHO</small><strong>' + count('add_to_cart') + '</strong></article>' +
        '<article><small>PEDIDOS CRIADOS</small><strong>' + count('order_created') + '</strong></article>' +
        '</div>' +
        '<h2>PRODUTOS MAIS VISUALIZADOS</h2>' +
        '<div class="admin-table">' +
        (top.length ? top.map(function (slug) {
          return '<p class="admin-row"><b>' + esc(slug) + '</b><span>' +
            views[slug] + ' visualizações · ' + (adds[slug] || 0) +
            ' adições ao carrinho</span></p>';
        }).join('') : '<p class="cart-small">Ainda não existem eventos suficientes para gerar tendências.</p>') +
        '</div>' +
        '<h2>LIMPEZA DE DADOS DE TESTE</h2>' +
        '<p>Encomendas identificadas como teste: <b>' + testOrders + '</b></p>' +
        '<p>Eventos identificados como teste: <b>' + testEvents + '</b></p>' +
        '<p class="cart-small">A limpeza não apaga produtos, categorias, stock ou encomendas reais.</p>' +
        '<button type="button" id="resetTestData">LIMPAR DADOS DE TESTE</button>' +
        '<p class="cart-small">A amostra limita-se aos últimos 2.000 eventos e 1.000 pedidos.</p>';

      document.getElementById('resetTestData').onclick = async function () {
        if (!confirm('ATENÇÃO: serão apagadas as encomendas e métricas identificadas como teste. Os produtos e encomendas reais serão preservados. Continuar?')) return;
        if (!confirm('Confirma novamente que queres apagar os dados de teste?')) return;

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
        alert('Limpeza concluída.\\nEncomendas apagadas: ' + (d.orders_deleted || 0) + '\\nArtigos apagados: ' + (d.items_deleted || 0) + '\\nReservas apagadas: ' + (d.reservations_deleted || 0) + '\\nEventos apagados: ' + (d.events_deleted || 0));
        load('metrics');
      };
      return;
    }

    if (tab === 'orders') {
      var r = await db.from('orders')
        .select('id,order_number,customer_name,customer_phone,total,amount_paid,status,created_at,is_test,payment_method')
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
        '<button type="submit" class="btn btn-light">PESQUISAR</button></form>' +
        '<div id="orderSearchResult"></div>' +
        '<h2>ENCOMENDAS RECENTES</h2>' +
        '<div class="admin-table">' +
        ((r.data || []).map(renderOrder).join('') || '<p>Não existem encomendas.</p>') +
        '</div>';

      document.getElementById('orderSearchForm').onsubmit = function (e) {
        e.preventDefault();
        searchOrder(new FormData(e.target).get('reference'));
      };

      r.data.forEach(function (o) {
        var s = content.querySelector('[data-order="' + o.id + '"]');
        if (s) s.value = o.status;
      });

      content.querySelectorAll('[data-mark-test]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.dataset.markTest;
          if (!confirm('Confirmas que esta encomenda é exclusivamente de teste? Esta identificação permitirá apagá-la no reset.')) return;

          var result = await db.from('orders')
            .update({is_test: true})
            .eq('id', id)
            .in('status', ['pending_payment','payment_review','cancelled']);

          if (result.error) {
            alert('Não foi possível identificar como teste: ' + result.error.message);
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
          var order = r.data.find(function (o) { return o.id === id; });
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
            if (!confirm('Só confirma se verificaste realmente o comprovativo e recebeste o valor. O stock reservado será descontado. Continuar?')) return;
            x = await db.rpc('confirm_order_payment', {p_order_id: id});
          } else if (status === 'cancelled') {
            if (!confirm('Tens a certeza de que queres cancelar esta encomenda e libertar o stock reservado?')) return;
            x = await db.rpc('cancel_order_and_release_stock', {p_order_id: id});
          } else {
            x = await db.rpc('advance_order_status', {
              p_order_id: id,
              p_new_status: status
            });
          }

          if (x.error) {
            alert('Não foi possível atualizar a encomenda: ' + x.error.message);
            return;
          }
          alert('Encomenda atualizada com sucesso.');
          load('orders');
        };
      });
      
      content.querySelectorAll('[data-cancel-order]').forEach(function (b) {
        b.onclick = async function () {
          var id = b.dataset.cancelOrder;
          var order = r.data.find(function (o) { return o.id === id; });
          if (!order) return;
          if (Number(order.amount_paid || 0) > 0) {
            alert('Esta encomenda tem pagamento registado. Não pode ser cancelada por esta ação.');
            return;
          }
          if (!confirm('Confirmas o cancelamento da encomenda ' + order.order_number + '? O stock reservado será libertado.')) return;
          b.disabled = true;
          b.textContent = 'A CANCELAR...';
          var x = await db.rpc('cancel_order_and_release_stock', {p_order_id: id});
          if (x.error) {
            alert('Não foi possível cancelar a encomenda: ' + x.error.message);
            b.disabled = false;
            b.textContent = 'CANCELAR ENCOMENDA E LIBERTAR STOCK';
            return;
          }
          alert('Encomenda cancelada. O stock reservado foi libertado.');
          load('orders');
        };
      });
      return;
    }

    if (tab === 'categories') {
      content.innerHTML =
        '<h2>GESTÃO DE CATEGORIAS</h2>' +
        '<form id="categoryForm" class="admin-form">' +
        '<input name="name" placeholder="Nome da categoria" required>' +
        '<input name="slug" placeholder="Identificador (ex.: camisetas)" required>' +
        '<input name="description" placeholder="Descrição">' +
        '<button class="btn btn-light" type="submit">CRIAR CATEGORIA</button></form>' +
        '<div id="categoryList"></div>';

      var r = await db.from('categories').select('*').order('position');
      if (r.error) { content.textContent = 'Erro ao carregar categorias: ' + r.error.message; return; }

      var categoryList = document.getElementById('categoryList');
      categoryList.innerHTML = (r.data || []).map(function(c) {
        return '<article class="admin-row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 0">' +
          '<div style="flex:1;min-width:160px"><strong>' + esc(c.name) + '</strong> <small>/' + esc(c.slug) + '</small> ' +
          '<small>' + (c.is_active ? 'ACTIVA' : 'INACTIVA') + '</small></div>' +
          '<button type="button" data-edit-cat="' + esc(c.id) + '">EDITAR</button>' +
          '<button type="button" data-toggle-cat="' + esc(c.id) + '" data-active="' + c.is_active + '">' +
          (c.is_active ? 'DESATIVAR' : 'REATIVAR') + '</button>' +
          '<button type="button" class="danger" data-delete-cat="' + esc(c.id) + '">ELIMINAR</button></article>';
      }).join('') || '<p class="cart-small">Ainda não existem categorias.</p>';

      document.getElementById('categoryForm').onsubmit = async function(e) {
        e.preventDefault();
        var form = e.currentTarget;
        var d = new FormData(form);
        var name = String(d.get('name') || '').trim();
        var slug = String(d.get('slug') || '').toLowerCase().trim();
        var x = await db.from('categories').insert({
          name:name, slug:slug, description:String(d.get('description') || '').trim(),
          position:(r.data || []).length, is_active:true
        });
        if (x.error) alert('Não foi possível criar a categoria: ' + x.error.message);
        else { alert('Categoria criada. Já pode ser escolhida ao cadastrar produtos.'); load('categories'); }
      };

      categoryList.querySelectorAll('[data-edit-cat]').forEach(function(b) {
        b.onclick = async function() {
          var category = (r.data || []).find(function(c) { return c.id === b.dataset.editCat; });
          if (!category) return;
          var name = prompt('Nome da categoria:', category.name);
          if (name === null) return;
          name = name.trim();
          if (!name) { alert('O nome não pode ficar vazio.'); return; }
          var slug = prompt('Identificador (slug):', category.slug);
          if (slug === null) return;
          slug = slug.toLowerCase().trim();
          if (!slug) { alert('O identificador não pode ficar vazio.'); return; }
          var description = prompt('Descrição:', category.description || '');
          if (description === null) return;
          var x = await db.from('categories').update({
            name:name, slug:slug, description:description.trim()
          }).eq('id', category.id);
          if (x.error) alert('Não foi possível editar a categoria: ' + x.error.message);
          else { alert('Categoria actualizada.'); load('categories'); }
        };
      });

      categoryList.querySelectorAll('[data-toggle-cat]').forEach(function(b) {
        b.onclick = async function() {
          var nextActive = b.dataset.active !== 'true';
          var label = nextActive ? 'reativar' : 'desativar';
          if (!confirm('Confirmas ' + label + ' esta categoria? Os produtos associados não serão apagados.')) return;
          var x = await db.from('categories').update({is_active:nextActive}).eq('id', b.dataset.toggleCat);
          if (x.error) alert('Não foi possível alterar o estado: ' + x.error.message);
          else { alert(nextActive ? 'Categoria reactivada.' : 'Categoria desactivada.'); load('categories'); }
        };
      });

      categoryList.querySelectorAll('[data-delete-cat]').forEach(function(b) {
        b.onclick = async function() {
          var category = (r.data || []).find(function(c) { return c.id === b.dataset.deleteCat; });
          if (!category) return;
          var linked = await db.from('products').select('id').eq('category_id', category.id).limit(1);
          if (linked.error) { alert('Não foi possível verificar os produtos associados: ' + linked.error.message); return; }
          if (linked.data && linked.data.length) {
            alert('Esta categoria tem produtos associados. Desactiva-a ou transfere primeiro os produtos para outra categoria. Nenhum dado foi eliminado.');
            return;
          }
          if (!confirm('Eliminar permanentemente a categoria "' + category.name + '"?')) return;
          var x = await db.from('categories').delete().eq('id', category.id);
          if (x.error) alert('Não foi possível eliminar a categoria: ' + x.error.message);
          else { alert('Categoria eliminada.'); load('categories'); }
        };
      });
      return;
    }

    if (tab === 'products') {
      var cats = await db.from('categories').select('id,name,is_active').order('name');
      var ps = await db.from('products')
        .select('id,name,slug,category_id,price,stock,description,available_colors,is_active,categories(name),product_images(id,product_id,image_url,position)')
        .order('created_at', { ascending: false }).limit(100);

      if (cats.error || ps.error) {
        content.textContent = (cats.error || ps.error).message;
        return;
      }

      function slugify(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      function colorFields(selected) {
        var colors = ['Preto','Branco','Creme','Castanho'];
        selected = Array.isArray(selected) ? selected : [];
        return '<fieldset class="admin-color-field wide"><legend>Cores disponíveis</legend><div class="admin-color-options">' + colors.map(function(color){return '<label><input type="checkbox" name="available_colors" value="'+color+'" '+(selected.indexOf(color)>=0?'checked':'')+'> '+color+'</label>';}).join('') + '</div><label>Outras cores (separadas por vírgula)<input name="custom_colors" value="'+esc(selected.filter(function(color){return colors.indexOf(color)<0;}).join(', '))+'" placeholder="Ex.: Azul-marinho, Verde-oliva"></label></fieldset>';
      }
      function readColors(form) {
        var values = Array.from(form.querySelectorAll('input[name="available_colors"]:checked')).map(function(input){return input.value;});
        var custom = String((form.elements.custom_colors && form.elements.custom_colors.value) || '').split(',').map(function(value){return value.trim();}).filter(Boolean);
        custom.forEach(function(value){if(!values.some(function(existing){return existing.toLowerCase()===value.toLowerCase();})) values.push(value);});
        return values;
      }
      function imagePath(url) {
        var marker = '/storage/v1/object/public/product-images/';
        var at = String(url || '').indexOf(marker);
        return at < 0 ? null : decodeURIComponent(String(url).slice(at + marker.length));
      }
      function publicImageUrl(path) {
        return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      }
      function imageCard(im, index, count) {
        return '<div class="product-image-item">' +
          '<img src="' + esc(im.image_url) + '" alt="Imagem ' + (index + 1) + '">' +
          '<div class="product-image-actions">' +
          '<small>' + (im.position === 0 ? 'CAPA PRINCIPAL' : 'IMAGEM ' + (index + 1)) + '</small>' +
          (im.position !== 0 ? '<button type="button" data-cover-image="' + esc(im.id) + '">DEFINIR COMO CAPA</button>' : '') +
          '<label class="product-image-replace">TROCAR IMAGEM<input type="file" accept="image/jpeg,image/png,image/webp" data-replace-image="' + esc(im.id) + '"></label>' +
          '<button type="button" data-delete-image="' + esc(im.id) + '" class="danger">ELIMINAR</button>' +
          '</div></div>';
      }
      function productCard(p) {
        var images = (p.product_images || []).slice().sort(function(a,b){return a.position-b.position;});
        return '<article class="product-manage-card" data-product-card="' + esc(p.id) + '">' +
          '<div class="product-manage-head"><div><b>' + esc(p.name) + '</b><small>' +
          esc(p.categories && p.categories.name || 'Sem categoria') + ' · ' + money(p.price) +
          ' · Stock: ' + Number(p.stock) + '</small></div>' +
          '<button type="button" data-edit-product="' + esc(p.id) + '">EDITAR DADOS</button></div>' +
          '<div class="product-gallery-admin">' +
          (images.map(imageCard).join('') || '<p class="cart-small">Ainda sem fotografias.</p>') +
          '</div><div class="product-manage-footer">' +
          '<small>' + images.length + ' de 5 imagens</small>' +
          (images.length < 5 ? '<div class="product-add-image-box"><label class="product-add-image">+ SELECCIONAR IMAGENS<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-add-images="' + esc(p.id) + '"></label><div class="product-add-preview" data-add-preview="' + esc(p.id) + '" hidden></div><div class="product-add-actions" data-add-actions="' + esc(p.id) + '" hidden><button type="button" data-save-images="' + esc(p.id) + '">GUARDAR IMAGENS</button><button type="button" class="btn-cancel-images" data-cancel-images="' + esc(p.id) + '">CANCELAR</button></div></div>' : '<small>Limite de 5 imagens atingido.</small>') +
          '<button type="button" data-product-toggle="' + esc(p.slug) + '" data-active="' + p.is_active + '">' +
          (p.is_active ? 'DESATIVAR PRODUTO' : 'ACTIVAR PRODUTO') + '</button></div>' +
          '<form class="product-edit-form" data-edit-form="' + esc(p.id) + '" hidden>' +
          '<label>Nome do produto<input name="name" value="' + esc(p.name) + '" required></label>' +
          '<label>Identificador (gerado pelo nome)<input name="slug" value="' + esc(p.slug) + '" required></label>' +
          '<label>Categoria<select name="category_id"><option value="">Sem categoria</option>' +
          (cats.data || []).filter(function(c){return c.is_active || c.id===p.category_id;}).map(function(c){return '<option value="' + c.id + '"' + (c.id===p.category_id?' selected':'') + '>' + esc(c.name) + (c.is_active?'':' (inactiva)') + '</option>';}).join('') + '</select></label>' +
          '<label>Preço de venda (MT)<input name="price" type="number" min="0" step="0.01" value="' + Number(p.price) + '" required></label>' +
          '<label>Quantidade em stock<input name="stock" type="number" min="0" step="1" value="' + Number(p.stock) + '" required></label>' +
          '<label class="wide">Descrição<textarea name="description">' + esc(p.description || '') + '</textarea></label>' +
          colorFields(p.available_colors) +
          '<button type="submit">GUARDAR ALTERAÇÕES</button><button type="button" data-close-edit="' + esc(p.id) + '">FECHAR</button></form></article>';
      }

      content.innerHTML =
        '<h2>ADICIONAR PRODUTO</h2>' +
        '<p class="admin-help">Preenche os dados e escolhe livremente de 1 a 5 fotografias. Não precisas de seleccionar cinco. A primeira será a capa principal; poderás trocar, eliminar ou mudar a capa depois.</p>' +
        '<form id="productForm" class="admin-form product-create-form">' +
        '<label>Nome do produto<input name="name" placeholder="Ex.: Camiseta BLCKSI Essential" required></label>' +
        '<label>Identificador do produto<input name="slug" placeholder="Gerado automaticamente" required></label>' +
        '<label>Categoria<select name="category_id"><option value="">Escolher categoria</option>' +
        (cats.data || []).filter(function(c){return c.is_active;}).map(function(c){return '<option value="' + c.id + '">' + esc(c.name) + '</option>';}).join('') + '</select></label>' +
        '<label>Preço de venda (MT)<input name="price" type="number" min="0" step="0.01" placeholder="Ex.: 1500" required></label>' +
        '<label>Quantidade disponível em stock<input name="stock" type="number" min="0" step="1" value="0" required></label>' +
        '<label class="wide">Descrição do produto<textarea name="description" placeholder="Material, corte, tamanhos, detalhes..."></textarea></label>' +
        colorFields([]) +
        '<label class="wide">Fotografias do produto (escolhe de 1 a 5)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Escolhe apenas a quantidade que quiseres: 1, 2, 3, 4 ou 5 fotografias. Não é necessário preencher todas. Formatos: JPG, PNG ou WebP; máximo 10 MB cada.</small></label>' +
        '<div id="newImagePreview" class="product-gallery-admin wide"></div>' +
        '<button class="btn btn-light" type="submit">CRIAR PRODUTO</button></form>' +
        '<h2>CATÁLOGO E GESTÃO DE IMAGENS</h2>' +
        '<div class="product-manage-list">' + (ps.data || []).map(productCard).join('') + '</div>';

      var createForm = document.getElementById('productForm');
      var imageInput = createForm.elements.images;
      var preview = document.getElementById('newImagePreview');

      var selectedProductImages = [];
      var createPreviewUrls = [];

      function renderNewProductImages() {
        createPreviewUrls.forEach(function(url) { URL.revokeObjectURL(url); });
        createPreviewUrls = [];
        preview.innerHTML = selectedProductImages.map(function(file, i) {
          var url = URL.createObjectURL(file);
          createPreviewUrls.push(url);
          return '<div class="product-image-item"><img src="' + url + '" alt="Pré-visualização ' + (i+1) + '">' +
            '<div class="product-image-actions"><small>' + (i===0?'CAPA PRINCIPAL':'IMAGEM '+(i+1)) +
            '</small><small>' + esc(file.name) + '</small>' +
            '<button type="button" data-remove-new-image="' + i + '" class="danger">REMOVER</button></div></div>';
        }).join('');
      }

      imageInput.addEventListener('change', function() {
        var newlySelected = Array.from(imageInput.files || []);
        imageInput.value = '';
        if (!newlySelected.length) return;
        var valid = newlySelected.filter(function(file) {
          return /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 10 * 1024 * 1024;
        });
        if (valid.length !== newlySelected.length) {
          alert('Escolhe apenas imagens JPG, PNG ou WebP até 10 MB cada.');
        }
        valid.forEach(function(file) {
          var duplicate = selectedProductImages.some(function(existing) {
            return existing.name === file.name && existing.size === file.size &&
              existing.lastModified === file.lastModified;
          });
          if (!duplicate && selectedProductImages.length < 5) selectedProductImages.push(file);
        });
        if (selectedProductImages.length >= 5 && valid.length > 0) {
          alert('O limite é de 5 imagens por produto. As primeiras 5 foram mantidas.');
        }
        renderNewProductImages();
      });

      preview.addEventListener('click', function(e) {
        var button = e.target.closest('[data-remove-new-image]');
        if (!button) return;
        selectedProductImages.splice(Number(button.dataset.removeNewImage), 1);
        renderNewProductImages();
      });
      createForm.elements.name.addEventListener('input', function() {
        createForm.elements.slug.value = slugify(createForm.elements.name.value);
      });
      createForm.elements.slug.addEventListener('input', function() {
        createForm.elements.slug.dataset.manual = 'true';
      });

      async function uploadImages(productId, files, startPosition) {
        var rows = [];
        for (var i = 0; i < files.length; i++) {
          var file = files[i];
          if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
            throw new Error('Imagem inválida ou superior a 10 MB: ' + file.name);
          }
          var ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
          var path = productId + '/' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2) + '.' + ext;
          var up = await db.storage.from('product-images').upload(path, file, { upsert: false, contentType: file.type });
          if (up.error) throw up.error;
          rows.push({ product_id: productId, image_url: publicImageUrl(path), position: startPosition + i });
        }
        if (rows.length) {
          var ins = await db.from('product_images').insert(rows);
          if (ins.error) throw ins.error;
        }
      }

      createForm.onsubmit = async function(e) {
        e.preventDefault();
        var files = selectedProductImages.slice();
        if (files.length < 1 || files.length > 5) {
          alert('Selecciona entre 1 e 5 imagens para o produto.');
          return;
        }
        var d = new FormData(createForm);
        var button = createForm.querySelector('button[type="submit"]');
        button.disabled = true; button.textContent = 'A CRIAR PRODUTO...';
        var result = await db.from('products').insert({
          name: String(d.get('name')).trim(),
          slug: slugify(d.get('slug')),
          category_id: d.get('category_id') || null,
          price: Number(d.get('price')),
          stock: Number(d.get('stock')),
          description: d.get('description'),
          available_colors: readColors(createForm),
          is_active: true
        }).select('id').single();
        if (result.error) {
          alert('Não foi possível criar o produto: ' + result.error.message);
          button.disabled = false; button.textContent = 'CRIAR PRODUTO'; return;
        }
        try {
          await uploadImages(result.data.id, files, 0);
          alert('Produto criado com ' + files.length + ' imagem(ns).');
          load('products');
        } catch (err) {
          alert('O produto foi criado, mas houve um erro ao guardar as imagens: ' + err.message + '. Podes adicioná-las na gestão do produto.');
          load('products');
        }
      };

      content.querySelectorAll('[data-product-toggle]').forEach(function(b) {
        b.onclick = async function() {
          var x = await db.from('products').update({is_active:b.dataset.active!=='true'}).eq('slug',b.dataset.productToggle);
          if (x.error) alert(x.error.message); else load('products');
        };
      });
      content.querySelectorAll('[data-edit-product]').forEach(function(b) {
        b.onclick = function() {
          var form = content.querySelector('[data-edit-form="' + b.dataset.editProduct + '"]');
          if (form) form.hidden = !form.hidden;
        };
      });
      content.querySelectorAll('[data-close-edit]').forEach(function(b) {
        b.onclick = function() { var form=content.querySelector('[data-edit-form="' + b.dataset.closeEdit + '"]'); if(form) form.hidden=true; };
      });
      content.querySelectorAll('[data-edit-form]').forEach(function(form) {
        form.elements.name.addEventListener('input',function(){form.elements.slug.value=slugify(form.elements.name.value);});
        form.onsubmit = async function(e) {
          e.preventDefault();
          var d = new FormData(form);
          var x = await db.from('products').update({
            name:String(d.get('name')).trim(), slug:slugify(d.get('slug')),
            category_id:d.get('category_id')||null, price:Number(d.get('price')),
            stock:Number(d.get('stock')), description:d.get('description'),
            available_colors:readColors(form)
          }).eq('id',form.dataset.editForm);
          if(x.error) alert('Erro ao actualizar produto: '+x.error.message); else {alert('Dados do produto actualizados.');load('products');}
        };
      });

      content.querySelectorAll('[data-add-images]').forEach(function(input) {
        var productId = input.dataset.addImages;
        var product = ps.data.find(function(p) { return p.id === productId; });
        var currentCount = (product && product.product_images || []).length;
        var previewBox = content.querySelector('[data-add-preview="' + productId + '"]');
        var actions = content.querySelector('[data-add-actions="' + productId + '"]');
        var saveButton = content.querySelector('[data-save-images="' + productId + '"]');
        var cancelButton = content.querySelector('[data-cancel-images="' + productId + '"]');
        var stagedFiles = [];
        var objectUrls = [];

        function clearStaged() {
          objectUrls.forEach(function(url) { URL.revokeObjectURL(url); });
          objectUrls = [];
          stagedFiles = [];
          input.value = '';
          previewBox.innerHTML = '';
          previewBox.hidden = true;
          actions.hidden = true;
          saveButton.disabled = false;
          saveButton.textContent = 'GUARDAR IMAGENS';
        }

        function renderStagedImages() {
          objectUrls.forEach(function(url) { URL.revokeObjectURL(url); });
          objectUrls = [];
          previewBox.innerHTML = stagedFiles.map(function(file, index) {
            var url = URL.createObjectURL(file);
            objectUrls.push(url);
            return '<div class="product-image-item"><img src="' + url + '" alt="Pré-visualização ' + (index + 1) + '"><div class="product-image-actions"><small>' +
              (currentCount === 0 && index === 0 ? 'CAPA PRINCIPAL' : 'NOVA IMAGEM ' + (index + 1)) +
              '</small><small>' + esc(file.name) + '</small><button type="button" class="danger" data-remove-staged="' + index + '">REMOVER</button></div></div>';
          }).join('');
          previewBox.hidden = stagedFiles.length === 0;
          actions.hidden = stagedFiles.length === 0;
        }

        input.onchange = function() {
          // Ler os ficheiros ANTES de limpar o input; limpá-lo primeiro apagava a selecção.
          var newlySelected = Array.from(input.files || []);
          input.value = '';
          if (!newlySelected.length) return;

          var available = 5 - currentCount - stagedFiles.length;
          if (available <= 0) {
            alert('Este produto já tem 5 imagens seleccionadas ou guardadas.');
            return;
          }

          var invalid = newlySelected.find(function(file) {
            return !/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024;
          });
          if (invalid) {
            alert('Escolhe apenas imagens JPG, PNG ou WebP até 10 MB cada. Ficheiro inválido: ' + invalid.name);
            return;
          }

          newlySelected.forEach(function(file) {
            var duplicate = stagedFiles.some(function(existing) {
              return existing.name === file.name && existing.size === file.size &&
                existing.lastModified === file.lastModified;
            });
            if (!duplicate && stagedFiles.length < 5 - currentCount) stagedFiles.push(file);
          });

          if (newlySelected.length > available) {
            alert('Só podes adicionar mais ' + available + ' imagem(ns). O limite total é 5 por produto.');
          }
          renderStagedImages();
        };

        previewBox.addEventListener('click', function(e) {
          var removeButton = e.target.closest('[data-remove-staged]');
          if (!removeButton) return;
          stagedFiles.splice(Number(removeButton.dataset.removeStaged), 1);
          renderStagedImages();
        });
        cancelButton.onclick = clearStaged;
        saveButton.onclick = async function() {
          if (!stagedFiles.length || saveButton.disabled) return;
          saveButton.disabled = true;
          cancelButton.disabled = true;
          saveButton.textContent = 'A GUARDAR...';
          try {
            await uploadImages(productId, stagedFiles, currentCount);
            clearStaged();
            alert('Imagem(ns) guardada(s) com sucesso.');
            load('products');
          } catch(err) {
            alert('Erro ao guardar imagens: ' + err.message + '. As imagens seleccionadas continuam disponíveis para tentares novamente ou cancelar.');
            saveButton.disabled = false;
            saveButton.textContent = 'GUARDAR IMAGENS';
          } finally {
            cancelButton.disabled = false;
          }
        };
      });
      content.querySelectorAll('[data-replace-image]').forEach(function(input) {
        input.onchange = async function() {
          var file=input.files&&input.files[0]; if(!file)return;
          if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024){alert('Escolhe JPG, PNG ou WebP até 10 MB.');return;}
          var imageId=input.dataset.replaceImage;
          var old=(ps.data.flatMap(function(p){return p.product_images||[];})).find(function(im){return im.id===imageId;});
          if(!old)return;
          try {
            var ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];
            var path=old.product_id+'/'+Date.now()+'-replace-'+Math.random().toString(36).slice(2)+'.'+ext;
            var up=await db.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});
            if(up.error)throw up.error;
            var url=publicImageUrl(path);
            var upd=await db.from('product_images').update({image_url:url}).eq('id',imageId);
            if(upd.error){await db.storage.from('product-images').remove([path]);throw upd.error;}
            var oldPath=imagePath(old.image_url);
            if(oldPath) await db.storage.from('product-images').remove([oldPath]);
            alert('Imagem substituída com sucesso.');load('products');
          } catch(err){alert('Não foi possível trocar a imagem: '+err.message);}
        };
      });
      content.querySelectorAll('[data-delete-image]').forEach(function(b) {
        b.onclick = async function() {
          if(!confirm('Eliminar definitivamente esta imagem do produto?'))return;
          var imageId=b.dataset.deleteImage;
          var old=ps.data.flatMap(function(p){return p.product_images||[];}).find(function(im){return im.id===imageId;});
          if(!old)return;
          var del=await db.from('product_images').delete().eq('id',imageId);
          if(del.error){alert('Não foi possível remover a imagem da galeria: '+del.error.message);return;}
          var path=imagePath(old.image_url);
          if(path){var rm=await db.storage.from('product-images').remove([path]);if(rm.error){alert('Imagem removida da galeria, mas o ficheiro antigo não foi apagado: '+rm.error.message);load('products');return;}}
          alert('Imagem eliminada.');load('products');
        };
      });
      content.querySelectorAll('[data-cover-image]').forEach(function(b) {
        b.onclick = async function() {
          var imageId=b.dataset.coverImage;
          var product=ps.data.find(function(p){return (p.product_images||[]).some(function(im){return im.id===imageId;});});
          if(!product)return;
          var ordered=(product.product_images||[]).slice().sort(function(a,b){return a.position-b.position;});
          var updates=ordered.map(function(im,index){return db.from('product_images').update({position:im.id===imageId?0:(index+1)}).eq('id',im.id);});
          var results=await Promise.all(updates);
          var failed=results.find(function(x){return x.error;});
          if(failed){alert('Não foi possível alterar a capa: '+failed.error.message);return;}
          alert('Imagem principal actualizada.');load('products');
        };
      });
      return;
    }
  }

  document.getElementById('loginForm').onsubmit = async function (e) {
    e.preventDefault();
    var form = e.currentTarget;
    var button = form.querySelector('button[type="submit"]');
    var d = new FormData(form);
    button.disabled = true;
    button.textContent = 'A VALIDAR...';
    message.textContent = 'A validar acesso ao painel...';

    try {
      var r = await db.auth.signInWithPassword({
        email: d.get('email'),
        password: d.get('password')
      });

      if (r.error) {
        message.textContent = 'Falha no início de sessão: ' + r.error.message;
        return;
      }

      await show();
    } catch (err) {
      message.textContent = 'Erro ao abrir o painel: ' + (err && err.message ? err.message : String(err));
      console.error('BLCKSI admin login error:', err);
    } finally {
      button.disabled = false;
      button.textContent = 'ENTRAR NO PAINEL';
    }
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
