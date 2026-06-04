const money = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const statusSteps = [
  {
    key: 'Aguardando confirmação',
    title: 'Pedido recebido',
    icon: '🛍️',
    description: 'Recebemos sua solicitação e ela está aguardando confirmação.'
  },
  {
    key: 'Confirmado',
   title: '💖 Pedido confirmado',
    icon: '💖',
    description: 'Seu pedido foi confirmado pela AM Closet.'
  },
  {
    key: 'Separando pedido',
   title: '🛍️ Preparando seu pedido',
    icon: '🛍️',
    description: 'Estamos separando suas peças com cuidado.'
  },
  {
    key: 'Em rota',
    title: '🚚 Em transporte',
     icon: '🚚',
    description: 'Seu pedido está a caminho.'
  },
  {
    key: 'Pedido entregue',
   title: '✨ Pedido entregue',
     icon: '✨',
    description: 'Seu pedido foi entregue. Esperamos que ame sua compra!'
  }
];

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getStatusIndex(status) {
  const index = statusSteps.findIndex(step => step.key === status);

  if (index === -1) {
    return 0;
  }

  return index;
}

function getStatusLabel(status) {
  const step = statusSteps.find(step => step.key === status);
  return step ? step.title : status;
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
    const currentIndex = getStatusIndex(currentStatus);

    const progressPercent = currentStatus === 'Cancelado'
      ? 0
      : (currentIndex / (statusSteps.length - 1)) * 100;

    const timeline = statusSteps.map((step, index) => {
      const active = currentStatus !== 'Cancelado' && currentIndex >= index;
      const current = currentStatus !== 'Cancelado' && currentIndex === index;

      return `
        <div class="pedido-step-premium ${active ? 'ativo' : ''} ${current ? 'atual' : ''}">
          <div class="pedido-step-icon">${active ? '✓' : step.icon}</div>
          <div>
            <strong>${step.title}</strong>
            <p>${step.description}</p>
          </div>
        </div>
      `;
    }).join('');

    const itemsHtml = items.map(item => {
      const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);

      return `
        <li>
          <div>
            <strong>${item.name || 'Produto'}</strong>
            <small>Quantidade: ${item.quantity || 1}</small>
          </div>
          <span>${money(itemTotal)}</span>
        </li>
      `;
    }).join('');

    result.innerHTML = `
      <div class="pedido-card pedido-card-premium">
        <div class="pedido-card-header">
          <div>
            <small>Acompanhamento em tempo real</small>
            <h2>${customer.order_code || ('Pedido #' + order.id)}</h2>
          </div>

          <span class="pedido-status-badge ${currentStatus === 'Cancelado' ? 'cancelado' : ''}">
            ${currentStatus === 'Cancelado' ? 'Cancelado' : getStatusLabel(currentStatus)}
          </span>
        </div>

        <div class="pedido-info-grid">
          <p><strong>Cliente</strong><br>${customer.name || '-'}</p>
          <p><strong>Pagamento</strong><br>${customer.payment_label || customer.payment_method || '-'}</p>
          <p><strong>Total</strong><br>${money(customer.total || 0)}</p>
        </div>

        ${
          currentStatus !== 'Cancelado'
            ? `
              <div class="pedido-progress">
                <div class="pedido-progress-line">
                  <span style="width:${progressPercent}%"></span>
                </div>
              </div>

              <div class="pedido-timeline-premium">
                ${timeline}
              </div>
            `
            : `
              <div class="pedido-cancelado-box">
                <strong>Pedido cancelado</strong>
                <p>${customer.cancel_reason || 'Pedido cancelado pela loja.'}</p>
              </div>
            `
        }

        ${
          customer.tracking_code
            ? `
              <div class="pedido-rastreio">
                <strong>Código de rastreio</strong>
                <p>${customer.tracking_code}</p>
              </div>
            `
            : ''
        }

        <div class="pedido-produtos-box">
          <h3>Produtos do pedido</h3>
          <ul class="pedido-items-premium">
            ${itemsHtml || '<li>Nenhum produto listado.</li>'}
          </ul>
        </div>

<div class="pedido-ajuda">
  <p>Precisa de ajuda com seu pedido?</p>

  <a
    href="https://wa.me/5585991346349"
    target="_blank"
    class="pedido-whatsapp-btn"
  >
    Falar com a AM Closet
  </a>
</div>
    `;

  } catch (error) {
    console.error(error);
    msg.textContent = 'Erro ao consultar pedido.';
  }
}
