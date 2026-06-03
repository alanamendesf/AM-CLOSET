const money = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const statusSteps = [
  'Aguardando confirmação',
  'Confirmado',
  'Separando pedido',
  'Em rota',
  'Pedido entregue'
];

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

async function searchOrder() {
  const msg = document.getElementById('pedidoMsg');
  const result = document.getElementById('pedidoResultado');

  const orderId = document.getElementById('orderId').value.trim();
  const phone = document.getElementById('phone').value.trim();

  result.innerHTML = '';

  if (!orderId || !phone) {
    msg.textContent = 'Preencha o número do pedido e o WhatsApp.';
    return;
  }

  msg.textContent = 'Buscando pedido...';

  try {
    const r = await fetch('/api/order-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        phone: normalizePhone(phone)
      })
    });

    const data = await r.json();

    if (!r.ok) {
      msg.textContent = data.error || 'Pedido não encontrado.';
      return;
    }

    msg.textContent = '';

    const order = data.order;
    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const currentStatus = order.status || 'Aguardando confirmação';

    const currentIndex = statusSteps.indexOf(currentStatus);

    const timeline = statusSteps.map((step, index) => {
      const active = currentIndex >= index;
      return `
        <div class="pedido-step ${active ? 'ativo' : ''}">
          <span>${active ? '✓' : '○'}</span>
          <p>${step}</p>
        </div>
      `;
    }).join('');

    const itemsHtml = items.map(item => `
      <li>
        <strong>${item.name || 'Produto'}</strong><br>
        Quantidade: ${item.quantity || 1}<br>
        Valor: ${money(item.price || 0)}
      </li>
    `).join('');

    result.innerHTML = `
      <div class="pedido-card">
        <h2>Pedido #${order.id}</h2>

        <p><strong>Cliente:</strong> ${customer.name || '-'}</p>
        <p><strong>Status atual:</strong> ${currentStatus}</p>
        <p><strong>Forma de pagamento:</strong> ${customer.payment_label || customer.payment_method || '-'}</p>
        <p><strong>Total:</strong> ${money(customer.total || 0)}</p>

        <div class="pedido-timeline">
          ${timeline}
        </div>

        <h3>Produtos</h3>
        <ul class="pedido-items">
          ${itemsHtml || '<li>Nenhum produto listado.</li>'}
        </ul>

        ${
          currentStatus === 'Cancelado'
            ? `<p class="pedido-cancelado"><strong>Pedido cancelado:</strong> ${customer.cancel_reason || '-'}</p>`
            : ''
        }
      </div>
    `;

  } catch (error) {
    console.error(error);
    msg.textContent = 'Erro ao consultar pedido.';
  }
}
