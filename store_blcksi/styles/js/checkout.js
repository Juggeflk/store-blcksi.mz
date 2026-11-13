
(function () {
  var form = document.getElementById('checkoutForm');

  if (!form || !window.BLCKSICart) return;

  var items = BLCKSICart.read();
  var total = BLCKSICart.total();
  var lines = document.getElementById('checkoutLines');
  var totalEl = document.getElementById('checkoutTotal');
  var msg = document.getElementById('checkoutMessage');
  var btn = document.getElementById('placeOrder');

  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }

  lines.innerHTML = items.map(function (x) {
    return '<p class="checkout-line">' +
      esc(x.name) + ' × ' + x.qty +
      ' <b>' +
      (x.price == null ? '—' : BLCKSICart.money(x.price * x.qty)) +
      '</b></p>';
  }).join('');

  totalEl.textContent = BLCKSICart.money(total);

  if (!items.length) {
    form.hidden = true;
    msg.textContent = 'O carrinho está vazio. Adiciona produtos antes de finalizar.';
    return;
  }

  if (items.some(function (x) {
    return x.price == null || !Number.isFinite(x.price);
  })) {
    btn.disabled = true;
    msg.textContent = 'Há produtos sem preço definido. Contacta a BLCKSI para obter cotação.';
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var data = new FormData(form);

    var payload = {
      customer: {
        name: String(data.get('name')).trim(),
        phone: String(data.get('phone')).trim(),
        address: String(data.get('address')).trim()
      },
      notes: String(data.get('notes') || '').trim(),
      payment_method: String(data.get('payment_method') || 'M-Pesa'),
      items: items.map(function (x) {
        return {
          slug: x.slug,
          quantity: x.qty,
          size: x.size || null
        };
      })
    };

    if (
      !payload.customer.name ||
      !payload.customer.phone ||
      !payload.customer.address
    ) return;

    btn.disabled = true;
    btn.textContent = 'A CRIAR PEDIDO…';
    msg.textContent = 'A validar os produtos e a registar a encomenda.';

    var order = null;
    var cfg = window.BLCKSI_SUPABASE || {};
    var ready = cfg.url && cfg.key &&
      !cfg.url.includes('COLOQUE_AQUI');

    try {
      if (ready && window.supabase) {
        var client = window.supabase.createClient(cfg.url, cfg.key);

        var result = await client.functions.invoke('create-order', {
          body: payload
        });

        if (result.error) throw result.error;

        order = result.data;

        if (!order || !order.order_number) {
          throw new Error('Resposta inválida do servidor.');
        }

        if (
          !order.reservation_expires_at ||
          !Number.isFinite(Date.parse(order.reservation_expires_at))
        ) {
          throw new Error('Prazo da reserva não recebido do servidor.');
        }
      }
    } catch (err) {
      console.error(err);

      msg.textContent =
        'Não foi possível registar a encomenda corretamente. ' +
        'A loja não vai indicar que o pedido foi confirmado. ' +
        'Tenta novamente ou contacta a equipa.';

      btn.disabled = false;
      btn.textContent = 'TENTAR NOVAMENTE';
      return;
    }

    if (!order) {
      msg.textContent =
        'Para registar encomendas é necessário configurar o Supabase ' +
        'e publicar a função segura create-order. Nenhuma encomenda foi registada.';

      btn.disabled = false;
      btn.textContent = 'CRIAR PEDIDO';
      return;
    }

    var expiryDate = new Date(order.reservation_expires_at);

    var expiryText = new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Africa/Maputo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(expiryDate);

    var text = [
      'NOVO PEDIDO — BLCKSI',
      'Referência: ' + order.order_number,
      'Cliente: ' + payload.customer.name,
      'Contacto: ' + payload.customer.phone,
      'Entrega: ' + payload.customer.address,
      '',
      'PRODUTOS:'
    ].concat(
      items.map(function (x) {
        return '- ' + x.name +
          (x.size ? ' / ' + x.size : '') +
          ' × ' + x.qty +
          ' — ' + BLCKSICart.money(x.price * x.qty);
      }),
      [
        '',
        'TOTAL: ' + BLCKSICart.money(order.total),
        'Estado: PENDENTE DE PAGAMENTO',
        'Método escolhido: ' + payload.payment_method,
        '',
        'PRAZO PARA PAGAMENTO:',
        'Tens 30 minutos para efetuar o pagamento.',
        'A reserva termina em: ' + expiryText + ' (hora de Moçambique).',
        '',
        'IMPORTANTE: Se o prazo terminar, a reserva será libertada automaticamente.',
        'Pagamentos efetuados depois da expiração precisam de verificação pela BLCKSI.',
        '',
        'Anexarei o comprovativo nesta conversa.'
      ]
    ).join('\n');

    var wa = 'https://wa.me/258849220801?text=' +
      encodeURIComponent(text);

    if (window.BLCKSIAnalytics) {
      window.BLCKSIAnalytics.track('order_created', {
        order_number: order.order_number,
        total: order.total
      });
    }

    BLCKSICart.clear();

    msg.textContent =
      'Pedido ' + order.order_number +
      ' registado. A abrir WhatsApp para anexares o comprovativo.';

    window.location.href = wa;
  });
})();
