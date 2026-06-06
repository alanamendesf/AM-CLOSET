const money = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const pass = () => document.getElementById('pass').value;

let adminProductsData = [];
let adminOrdersData = [];
let adminCustomersData = [];

function loginAdmin() {
  if (!pass()) {
    adminMsg.textContent = 'Digite a senha do painel.';
    return;
  }

  localStorage.setItem('am_admin_pass', pass());

  loginPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');

  loadAdmin();
}

function logoutAdmin() {
  localStorage.removeItem('am_admin_pass');
  location.reload();
}

function showAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelectorAll('.admin-tabs button').forEach(button => {
    button.classList.remove('active');
  });

  document.getElementById(tabId).classList.add('active');

  const activeButton = document.querySelector(`.admin-tabs button[data-tab="${tabId}"]`);
  if (activeButton) activeButton.classList.add('active');
}

async function uploadImage() {
  const file = document.getElementById('pfile').files[0];

  if (!file) {
    return document.getElementById('pimg').value || '/produto-1.svg';
  }

  const formData = new FormData();
  formData.append('image', file);

  const r = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'x-admin-password': pass() },
    body: formData
  });

  const d = await r.json();
  return d.image || '/produto-1.svg';
}

async function loadAdmin() {
  const savedPass = localStorage.getItem('am_admin_pass');

  if (savedPass && document.getElementById('pass')) {
    document.getElementById('pass').value = savedPass;
  }

  try {
    const config = await (await fetch('/api/config')).json();

    storeName.value = config.storeName || 'AM Closet';
    subtitle.value = config.subtitle || 'Looks que valorizam você! ♡';
    whatsapp.value = config.whatsapp || '';
    instagram.value = config.instagram || '@useamcloseet';

    await loadProducts();
    await loadOrders();
    await loadCustomers();

    renderDashboard();

    adminMsg.textContent = 'Painel carregado com sucesso.';
  } catch (error) {
    console.error(error);
    adminMsg.textContent = 'Erro ao carregar painel.';
  }
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboardCards');
  if (!dashboard) return;

  const totalProducts = adminProductsData.length;
  const totalCustomers = adminCustomersData.length;

  const pedidosPendentes = adminOrdersData.filter(o =>
    o.status === 'Aguardando pagamento' ||
    o.status === 'Aguardando confirmação' ||
    o.status === 'Pagamento pendente'
  ).length;

  const pedidosConfirmados = adminOrdersData.filter(o =>
    o.status === 'Confirmado'
  ).length;

  const pedidosSeparando = adminOrdersData.filter(o =>
    o.status === 'Separando pedido'
  ).length;

  const pedidosEmRota = adminOrdersData.filter(o =>
    o.status === 'Em rota'
  ).length;

  const pedidosEntregues = adminOrdersData.filter(o =>
    o.status === 'Pedido entregue'
  ).length;

  const pedidosCancelados = adminOrdersData.filter(o =>
    o.status === 'Cancelado'
  ).length;

  const faturamento = adminOrdersData.reduce((sum, order) => {
    if (order.status === 'Cancelado') return sum;
    return sum + Number(order.customer?.total || 0);
  }, 0);

  dashboard.innerHTML = `
    <div class="dashboard-card">
      <small>Produtos</small>
      <strong>${totalProducts}</strong>
    </div>

    <div class="dashboard-card">
      <small>Clientes</small>
      <strong>${totalCustomers}</strong>
    </div>

    <div class="dashboard-card">
      <small>Pendentes</small>
      <strong>${pedidosPendentes}</strong>
    </div>

    <div class="dashboard-card">
      <small>Confirmados</small>
      <strong>${pedidosConfirmados}</strong>
    </div>

    <div class="dashboard-card">
      <small>Separando</small>
      <strong>${pedidosSeparando}</strong>
    </div>

    <div class="dashboard-card">
      <small>Em rota</small>
      <strong>${pedidosEmRota}</strong>
    </div>

    <div class="dashboard-card">
      <small>Entregues</small>
      <strong>${pedidosEntregues}</strong>
    </div>

    <div class="dashboard-card">
      <small>Cancelados</small>
      <strong>${pedidosCancelados}</strong>
    </div>

    <div class="dashboard-card">
      <small>Faturamento</small>
      <strong>${money(faturamento)}</strong>
    </div>
  `;
}

async function loadProducts() {
  const data = await (await fetch('/api/products')).json();

  if (!Array.isArray(data)) {
    adminProducts.innerHTML = data.details || data.error || 'Erro ao carregar produtos.';
    return;
  }

  adminProductsData = data;

  if (!data.length) {
    adminProducts.innerHTML = '<p>Nenhum produto cadastrado ainda.</p>';
    return;
  }

  adminProducts.innerHTML = data.map(p => `
    <article class="card produto-card admin-product-card">
      <img src="${p.image || '/produto-1.svg'}" onerror="this.src='/produto-1.svg'">

      <div class="card-body">
        <h3>${p.name || 'Produto sem nome'}</h3>
        <b>${money(p.price || 0)}</b>
        <small>Categoria: ${p.category || 'Sem categoria'}</small>
        <small>Tamanhos: ${p.sizes || 'Não informado'}</small>
        <small>Estoque: ${p.stock || 0}</small>

        <div class="admin-edit-form">
          <input id="name-${p.id}" value="${p.name || ''}" placeholder="Nome">
          <input id="price-${p.id}" value="${p.price || 0}" type="number" step="0.01" placeholder="Preço">
          <input id="cat-${p.id}" value="${p.category || ''}" placeholder="Categoria">
          <input id="sizes-${p.id}" value="${p.sizes || ''}" placeholder="Tamanhos">
          <input id="stock-${p.id}" value="${p.stock || 0}" type="number" placeholder="Estoque">
          <input id="img-${p.id}" value="${p.image || ''}" placeholder="Imagem">
          <textarea id="desc-${p.id}" placeholder="Descrição">${p.description || ''}</textarea>
        </div>

        <div class="admin-actions">
          <button onclick="editProduct('${p.id}')">Salvar</button>
          <button class="btn-danger" onclick="delProduct('${p.id}')">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');
}

async function loadOrders() {
  try {
    const data = await (await fetch('/api/orders', {
      headers: { 'x-admin-password': pass() }
    })).json();

    if (!Array.isArray(data)) {
      orders.innerHTML = 'Digite a senha para ver pedidos.';
      return;
    }

    adminOrdersData = data;

    if (!data.length) {
      orders.innerHTML = 'Nenhum pedido encontrado.';
      return;
    }

    orders.innerHTML = data.map(o => {
      const customer = o.customer || {};
      const items = Array.isArray(o.items) ? o.items : [];

      const itemsHtml = items.length
        ? items.map(i => `
          <li>
            <strong>${i.name || 'Produto'}</strong>
            <span>Qtd: ${i.quantity || 1}</span>
            <span>${money(i.price || 0)}</span>
          </li>
        `).join('')
        : '<li>Nenhum produto listado.</li>';

      return `
        <div class="order admin-order-card">
          <div class="order-top">
           <b>Pedido ${customer.order_code || o.id}</b>
            <span>${o.status || '-'}</span>
          </div>

          <div class="order-grid">
            <p><strong>Cliente:</strong> ${customer.name || '-'}</p>
            <p><strong>WhatsApp:</strong> ${customer.phone || '-'}</p>
            <p><strong>Pagamento:</strong> ${customer.payment_label || customer.payment_method || '-'}</p>
            <p><strong>Origem:</strong> ${customer.source || '-'}</p>
          </div>

          <div class="order-values">
            <p><strong>Subtotal:</strong> ${money(customer.subtotal || 0)}</p>
            <p><strong>Taxa:</strong> ${money(customer.fee_value || 0)}</p>
            <p><strong>Total:</strong> ${money(customer.total || 0)}</p>
          </div>

          <p><strong>Produtos:</strong></p>
          <ul class="order-items">${itemsHtml}</ul>

          ${
            o.status !== 'Cancelado'
              ? `
                <div class="order-status-actions">
                  <button onclick="updateOrderStatus('${o.id}', '${customer.phone || ''}', '${customer.name || ''}', 'Confirmado')">
                    Confirmado
                  </button>

                  <button onclick="updateOrderStatus('${o.id}', '${customer.phone || ''}', '${customer.name || ''}', 'Separando pedido')">
                    Separando pedido
                  </button>

                  <button onclick="updateOrderStatus('${o.id}', '${customer.phone || ''}', '${customer.name || ''}', 'Em rota')">
                    Em rota
                  </button>

                  <button onclick="updateOrderStatus('${o.id}', '${customer.phone || ''}', '${customer.name || ''}', 'Pedido entregue')">
                    Pedido entregue
                  </button>

                  <button class="btn-danger" onclick="cancelOrder('${o.id}', '${customer.phone || ''}', '${customer.name || ''}')">
                    Cancelar
                  </button>
                </div>

                <div class="tracking-box">
                  <input id="tracking-${o.id}" value="${customer.tracking_code || ''}" placeholder="Código de rastreio, se tiver">
                  <button onclick="sendTracking('${o.id}', '${customer.phone || ''}', '${customer.name || ''}')">
                    Enviar rastreio
                  </button>
                </div>
              `
              : `
                <p><strong>Motivo do cancelamento:</strong> ${customer.cancel_reason || '-'}</p>
              `
          }
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
    orders.innerHTML = 'Digite a senha para ver pedidos.';
  }
}

async function loadCustomers() {
  try {
    const data = await (await fetch('/api/customers', {
      headers: { 'x-admin-password': pass() }
    })).json();

    adminCustomersData = Array.isArray(data) ? data : [];

    customers.innerHTML = Array.isArray(data) && data.length
      ? data.map(c => `
        <div class="order admin-customer-card">
          <b>${c.name || 'Cliente'}</b>
          <p>WhatsApp: ${c.phone || '-'}</p>
          <button class="btn-danger" onclick="delCustomer('${c.id}')">Excluir cliente</button>
        </div>
      `).join('')
      : 'Nenhuma cliente cadastrada ainda.';
  } catch (e) {
    customers.innerHTML = 'Digite a senha para ver clientes.';
  }
}

async function saveConfig() {
  const body = {
    storeName: storeName.value,
    subtitle: subtitle.value,
    whatsapp: whatsapp.value,
    instagram: instagram.value
  };

  const r = await fetch('/api/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify(body)
  });

  const d = await r.json();
  adminMsg.textContent = d.error || 'Dados da loja salvos!';
}

async function addProduct() {
  const image = await uploadImage();

  const body = {
    name: pname.value,
    price: pprice.value,
    category: pcat.value,
    image,
    description: pdesc.value,
    stock: pstock.value,
    sizes: psizes.value
  };

  const r = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify(body)
  });

  const d = await r.json();
  adminMsg.textContent = d.error || 'Produto adicionado!';

  if (!d.error) {
    pname.value = '';
    pprice.value = '';
    pcat.value = '';
    psizes.value = '';
    pstock.value = '';
    pdesc.value = '';
    pfile.value = '';
    pimg.value = '';
  }

  await loadProducts();
  renderDashboard();
}

async function editProduct(id) {
  const body = {
    name: document.getElementById(`name-${id}`).value,
    price: document.getElementById(`price-${id}`).value,
    category: document.getElementById(`cat-${id}`).value,
    sizes: document.getElementById(`sizes-${id}`).value,
    stock: document.getElementById(`stock-${id}`).value,
    image: document.getElementById(`img-${id}`).value,
    description: document.getElementById(`desc-${id}`).value
  };

  const r = await fetch('/api/products/' + id, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify(body)
  });

  const d = await r.json();
  adminMsg.textContent = d.error || 'Produto atualizado!';
  await loadProducts();
  renderDashboard();
}

async function delProduct(id) {
  await fetch('/api/products/' + id, {
    method: 'DELETE',
    headers: { 'x-admin-password': pass() }
  });

  adminMsg.textContent = 'Produto excluído!';
  await loadProducts();
  renderDashboard();
}

async function delCustomer(id) {
  await fetch('/api/customers/' + id, {
    method: 'DELETE',
    headers: { 'x-admin-password': pass() }
  });

  adminMsg.textContent = 'Cliente excluída!';
  await loadCustomers();
  renderDashboard();
}

async function updateOrderStatus(orderId, customerPhone, customerName, status) {
  const r = await fetch('/api/orders/' + orderId + '/status', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify({ status })
  });

  const data = await r.json();

  if (!r.ok) {
    alert(data.details || data.error || 'Erro ao atualizar pedido.');
    return;
  }

  adminMsg.textContent = 'Pedido atualizado para: ' + status;

  const phone = String(customerPhone || '').replace(/\D/g, '');

  if (phone) {
    const finalPhone = phone.startsWith('55') ? phone : '55' + phone;

    const messages = {
      'Confirmado': `Olá, ${customerName || 'tudo bem'}! Aqui é da AM Closet.

Seu pedido foi confirmado e já está sendo preparado. ♡`,

      'Separando pedido': `Olá, ${customerName || 'tudo bem'}! Aqui é da AM Closet.

Estamos separando o seu pedido com muito carinho. ♡`,

      'Em rota': `Olá, ${customerName || 'tudo bem'}! Aqui é da AM Closet.

Seu pedido está em rota para entrega. ♡`,

      'Pedido entregue': `Olá, ${customerName || 'tudo bem'}! Aqui é da AM Closet.

Seu pedido foi entregue. Esperamos que ame sua peça! ♡`
    };

    const message = messages[status] || `Olá! Seu pedido na AM Closet foi atualizado para: ${status}.`;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  await loadOrders();
  renderDashboard();
}

async function sendTracking(orderId, customerPhone, customerName) {
  const input = document.getElementById('tracking-' + orderId);
  const trackingCode = input ? input.value.trim() : '';

  if (!trackingCode) {
    alert('Digite o código de rastreio.');
    return;
  }

  const r = await fetch('/api/orders/' + orderId + '/status', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify({
      status: 'Em rota',
      tracking_code: trackingCode
    })
  });

  const data = await r.json();

  if (!r.ok) {
    alert(data.details || data.error || 'Erro ao enviar rastreio.');
    return;
  }

  adminMsg.textContent = 'Código de rastreio salvo com sucesso.';

  const phone = String(customerPhone || '').replace(/\D/g, '');

  if (phone) {
    const finalPhone = phone.startsWith('55') ? phone : '55' + phone;

    const message = `Olá, ${customerName || 'tudo bem'}! Aqui é da AM Closet.

Seu pedido está em rota.

Código de rastreio:
${trackingCode}

Obrigada pela compra! ♡`;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  await loadOrders();
  renderDashboard();
}

async function cancelOrder(orderId, customerPhone, customerName) {
  const reason = prompt('Digite o motivo do cancelamento:');

  if (!reason) {
    return;
  }

  let phone = String(customerPhone || '').replace(/\D/g, '');

  if (!phone) {
    phone = prompt('WhatsApp da cliente não encontrado. Digite o número com DDD:');
    phone = String(phone || '').replace(/\D/g, '');
  }

  let whatsappWindow = null;

  if (phone) {
    whatsappWindow = window.open('', '_blank');
  }

  const r = await fetch('/api/orders/' + orderId + '/cancel', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': pass()
    },
    body: JSON.stringify({ reason })
  });

  let data = {};

try {
  data = await r.json();
} catch (e) {
  data = {};
}

  if (!r.ok) {
    if (whatsappWindow) whatsappWindow.close();
    alert(data.details || data.error || 'Erro ao cancelar pedido.');
    return;
  }

  adminMsg.textContent = 'Pedido cancelado com sucesso.';

  if (phone && whatsappWindow) {
    const finalPhone = phone.startsWith('55') ? phone : '55' + phone;

const message = `😔 Olá, ${customerName || 'cliente'}!

Infelizmente seu pedido na AM Closet precisou ser cancelado.

📦 Pedido: ${orderId}

📝 Motivo:
${reason}

💖 Pedimos desculpas pelo transtorno.

Caso tenha qualquer dúvida ou queira realizar um novo pedido, nossa equipe está à disposição.

👉 Fale conosco:
https://wa.me/5585991346349

🌷 Equipe AM Closet`;

   whatsappWindow.location = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
  }

  await loadOrders();
  renderDashboard();
}
