
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
  var paymentSelect = form.querySelector('[name="payment_method"]');
  var paymentBox = document.getElementById('blcksiPaymentDetails');

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

  function money(value) {
    return Number(value || 0).toLocaleString('pt-MZ') + ' MT';
  }

  function showMessage(text) {
    if (msg) msg.textContent = text;
  }

  function updatePaymentDetails() {
    if (!paymentBox || !paymentSelect) return;

    var method = paymentSelect.value;
    var details = paymentDetails[method];

    if (!details) {
      paymentBox.innerHTML = '<b>Método indisponível</b>';
      return;
    }

    paymentBox.innerHTML =
      '<b>Dados para pagamento — ' + method + '</b>' +
      '<p>Operadora: ' + details.operator + '</p>' +
      '<p>Número: <strong>' + details.number + '</strong></p>' +
      '<p>Titular: ' + details.holder + '</p>' +
      '<p>Confirma o nome do destinatário antes de pagar.</p>';
  }

  if (paymentSelect) {
    paymentSelect.addEventListener('change', updatePaymentDetails);
    updatePaymentDetails();
  }

  if (lines) {
    if (!items.length) {
      lines.textContent = 'O teu carrinho está vazio.';
    } else {
      lines.innerHTML = items.map(function (item) {
        return '<div class="cart-line">' +
          '<span>' + String(item.name || item.product_name || 'Produto') +
          ' × ' + Number(item.quantity || 1) + '</span>' +
          '<strong>' + money(
            Number(item.price || item.unit_price || 0) *
            Number(item.quantity || 1)
          ) + '</strong></div>';
      }).join('');
    }
  }

  if (totalEl) totalEl.textContent = money(total);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!items.length) {
      showMessage('O teu carrinho está vazio.');
      return;
    }

    var data = new FormData(form);
    var method = data.get('payment_method');
    var details = paymentDetails[method];

    if (!details) {
      showMessage('Seleciona um método de pagamento válido.');
      return;
    }

    var customer = {
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      address: String(data.get('address') || '').trim(),
      notes: String(data.get('notes') || '').trim()
    };

    if (!customer.name || !customer.phone || !customer.address) {
      showMessage('Preenche todos os campos obrigatórios.');
      return;
    }

    var config = window.BLCKSI_SUPABASE || {};
    var client = window.supabaseClient;

    if (!client && window.supabase && config.url && config.key) {
      client = window.supabase.createClient(config.url, config.key);
    }

    if (!client) {
      showMessage('Não foi possível ligar à loja. Tenta novamente.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'A CRIAR PEDIDO...';
    showMessage('A preparar o teu pedido...');

    try {
      var payload = {
        customer_name: customer.name,
        customer_phone: customer.phone,
        delivery_address: customer.address,
        notes: customer.notes,
        payment_method: method,
        items: items.map(function (item) {
          return {
            product_id: item.product_id || item.id,
            slug: item.slug || item.product_slug,
            size: item.size || null,
            quantity: Number(item.quantity || 1)
          };
        })
      };

      var result = await client.functions.invoke('create-order', {
        body: payload
      });

      if (result.error) {
        throw new Error(
          result.data && result.data.error
            ? result.data.error
            : 'Não foi possível criar o pedido.'
        );
      }

      var order = result.data || {};

      if (!order.order_number || !order.reservation_expires_at) {
        throw new Error('Resposta incompleta do servidor. Contacta a BLCKSI.');
      }

      var expiry = new Date(order.reservation_expires_at);

      var expiryText = expiry.toLocaleString('pt-MZ', {
        timeZone: 'Africa/Maputo',
        dateStyle: 'short',
        timeStyle: 'short'
      });

      var productLines = items.map(function (item) {
        return '- ' + (item.name || item.product_name || 'Produto') +
          ' | Qtd: ' + Number(item.quantity || 1) +
          ' | ' + money(
            Number(item.price || item.unit_price || 0) *
            Number(item.quantity || 1)
          );
      }).join('\n');

      var text =
        'NOVO PEDIDO — BLCKSI\n\n' +
        'Pedido: ' + order.order_number + '\n' +
        'Cliente: ' + customer.name + '\n' +
        'Contacto: ' + customer.phone + '\n' +
        'Entrega: ' + customer.address + '\n\n' +
        'PRODUTOS:\n' + productLines + '\n\n' +
        'TOTAL: ' + money(total) + '\n\n' +
        'PAGAMENTO:\n' +
        'Método: ' + method + '\n' +
        'Operadora: ' + details.operator + '\n' +
        'Número: ' + details.number + '\n' +
        'Titular: ' + details.holder + '\n\n' +
        'PRAZO DA RESERVA: 30 minutos\n' +
        'Expira em: ' + expiryText + '\n\n' +
        'Estado: PENDENTE DE CONFIRMAÇÃO\n' +
        'Vou anexar o comprovativo de pagamento nesta conversa.\n\n' +
        'Atenção: pagamentos realizados depois da expiração precisam de verificação da equipa BLCKSI.';

      if (customer.notes) {
        text += '\n\nNotas: ' + customer.notes;
      }

      var whatsapp =
        'https://wa.me/258849220801?text=' +
        encodeURIComponent(text);

      if (window.BLCKSICart.clear) {
        window.BLCKSICart.clear();
      }

      window.location.href = whatsapp;

    } catch (error) {
      console.error('BLCKSI checkout:', error);
      showMessage(error.message || 'Erro ao criar pedido.');
      btn.disabled = false;
      btn.textContent = 'CRIAR PEDIDO E CONTINUAR NO WHATSAPP';
    }
  });
})();
