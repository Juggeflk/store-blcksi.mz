
(function () {
  'use strict';

  var form = document.getElementById('checkoutForm');
  if (!form || !window.BLCKSICart) return;

  var items = BLCKSICart.read();
  var total = BLCKSICart.total();
  var lines = document.getElementById('checkoutLines');
  var totalEl = document.getElementById('checkoutTotal');
  var msg = document.getElementById('checkoutMessage');
  var btn = document.getElementById('placeOrder');

  // DADOS OFICIAIS DE PAGAMENTO BLCKSI
  var paymentDetails = {
    'M-Pesa': {
      operator: 'Vodacom',
      number: '849220801',
      holder: 'Alessandro A. M. Sitoe'
    },
    'e-Mola': {
      operator: 'Movitel',
      number: '877559214',
      holder: 'Alessandro A. M. Sitoe'
    }
  };

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

  // IDENTIFICAR MÉTODO DE PAGAMENTO
  var paymentControls = form.querySelectorAll(
    '[name="payment_method"]'
  );

  if (!paymentControls.length) {
    msg.textContent = 'Não foi encontrado o campo de método de pagamento.';
    btn.disabled = true;
    return;
  }

  // DESATIVAR TRANSFERÊNCIA BANCÁRIA
  paymentControls.forEach(function (control) {
    if (control.tagName === 'SELECT') {
      Array.from(control.options).forEach(function (option) {
        if (option.value === 'Transferência bancária') {
          option.disabled = true;
        }
      });

      if (control.value === 'Transferência bancária') {
        control.value = 'M-Pesa';
      }
    }

    if (
      control.type === 'radio' &&
      control.value === 'Transferência bancária'
    ) {
      control.disabled = true;
      control.checked = false;
    }
  });

  // CRIAR ÁREA DE DADOS DE PAGAMENTO NO CHECKOUT
  var paymentBox = document.createElement('div');
  paymentBox.id = 'blcksiPaymentDetails';

  paymentBox.style.cssText = [
    'margin:16px 0',
    'padding:18px',
    'border:1px solid #d8d8d8',
    'border-radius:10px',
    'background:#f7f7f7',
    'color:#171717',
    'line-height:1.7'
  ].join(';');

  var paymentAnchor =
    paymentControls[0].closest('fieldset') ||
    paymentControls[0].closest('.form-group') ||
    paymentControls[0].parentElement;

  if (paymentAnchor && paymentAnchor.parentElement) {
    paymentAnchor.insertAdjacentElement('afterend', paymentBox);
  } else {
    form.appendChild(paymentBox);
  }

  function getPaymentMethod() {
    var selected = form.querySelector(
      '[name="payment_method"]:checked'
    );

    if (selected) return selected.value;

    var control = form.querySelector(
      '[name="payment_method"]'
    );

    return control ? control.value : 'M-Pesa';
  }

  function updatePaymentDetails() {
    var method = getPaymentMethod();
    var details = paymentDetails[method];

    if (!details) {
      paymentBox.innerHTML =
        '<strong>Pagamento indisponível</strong>' +
        '<p>Seleciona M-Pesa ou e-Mola.</p>';
      return;
    }

    paymentBox.innerHTML =
      '<strong>Dados para pagamento — ' + esc(method) + '</strong>' +
      '<p>Operadora: ' + esc(details.operator) + '</p>' +
      '<p>Número: <strong>' + esc(details.number) + '</strong></p>' +
      '<p>Titular: <strong>' + esc(details.holder) + '</strong></p>' +
      '<p>Confirma o nome do destinatário antes de efetuar o pagamento.</p>';
  }

  paymentControls.forEach(function (control) {
    control.addEventListener('change', updatePaymentDetails);
  });

  updatePaymentDetails();

  // MOSTRAR PRODUTOS
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
    msg.textContent =
      'O carrinho está vazio. Adiciona produtos antes de finalizar.';
    return;
  }

  if (items.some(function (x) {
    return x.price == null || !Number.isFinite(x.price);
  })) {
    btn.disabled = true;
    msg.textContent =
      'Há produtos sem preço definido. Contacta a BLCKSI para obter cotação.';
    return;
  }

  // CRIAR ENCOMENDA
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var selectedMethod = getPaymentMethod();
    var payment = paymentDetails[selectedMethod];

    if (!payment) {
      msg.textContent = 'Seleciona um método de pagamento disponível.';
      return;
    }

    var payload = {
      customer: {
        name: String(data.get('name') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        address: String(data.get('address') || '').trim()
      },
      notes: String(data.get('notes') || '').trim(),
      payment_method: selectedMethod,
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
    msg.textContent =
      'A validar os produtos e a registar a encomenda.';

    var order = null;
    var cfg = window.BLCKSI_SUPABASE || {};
    var ready = cfg.url && cfg.key &&
      !cfg.url.includes('COLOQUE_AQUI');

    try {
      if (ready && window.supabase) {
        var client = window.supabase.createClient(
          cfg.url,
          cfg.key
        );

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
        'É necessário configurar o Supabase e publicar a função create-order.';

      btn.disabled = false;
      btn.textContent = 'CRIAR PEDIDO';
      return;
    }

    // DATA E HORA DE EXPIRAÇÃO
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

    // MENSAGEM PARA WHATSAPP
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
        '',
        'DADOS PARA PAGAMENTO',
        'Método: ' + selectedMethod,
        'Operadora: ' + payment.operator,
        'Número: ' + payment.number,
        'Titular: ' + payment.holder,
        '',
        'PRAZO PARA PAGAMENTO',
        'Tens 30 minutos para efetuar o pagamento.',
        'A reserva termina em: ' + expiryText +
          ' (hora de Moçambique).',
        '',
        'IMPORTANTE: Se o prazo terminar, a reserva será libertada automaticamente.',
        'Pagamentos posteriores à expiração precisam de verificação pela BLCKSI.',
        '',
        'Anexarei o comprovativo nesta conversa.'
      ]
    ).join('\n');

    var wa =
      'https://wa.me/258849220801?text=' +
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
