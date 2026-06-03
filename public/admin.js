const money = v => Number(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const pass = () => document.getElementById('pass').value;

async function uploadImage() {
  const file = document.getElementById('pfile').files[0];

  if (!file) {
    return document.getElementById('pimg').value || '/produto-1.svg';
  }

  const formData = new FormData();
  formData.append('image', file);

  const r = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'x-admin-password': pass()
    },
    body: formData
  });

  const d = await r.json();
  return d.image || '/produto-1.svg';
}

async function loadAdmin() {
  const config = await (await fetch('/api/config')).json();

  storeName.value = config.storeName || 'AM Closet';
  subtitle.value = config.subtitle || 'Looks que valorizam você! ♡';
  whatsapp.value = config.whatsapp || '';
  instagram.value = config.instagram || '@useamcloseet';

  await loadProducts();
  await loadOrders();
  await loadCustomers();
}

async function loadProducts() {
  const products = await (await fetch('/api/products')).json();

  adminProducts.innerHTML = products.map(p => `
    <article class="card produto-card">
      <img src="${p.image || '/produto-1.svg'}" onerror="this.src='/produto-1.svg'">
      <h3>${p.name}</h3>
      <b>${money(p.price)}</b>
      <small>Categoria: ${p.category || 'Sem categoria'}</small>
      <small>Tamanhos: ${p.sizes || ''}</small>
      <small>Estoque: ${p.stock}</small>

      <input id="name-${p.id}" value="${p.name || ''}">
      <input id="price-${p.id}" value="${p.price || 0}" type="number" step="0.01">
      <input id="cat-${p.id}" value="${p.category || ''}">
      <input id="sizes-${p.id}" value="${p.sizes || ''}">
      <input id="stock-${p.id}" value="${p.stock || 0}" type="number">
      <input id="img-${p.id}" value="${p.image || ''}">
      <textarea id="desc-${p.id}">${p.description || ''}</textarea>

      <button onclick="editProduct('${p.id}')">Salvar alterações</button>
      <button onclick="delProduct('${p.id}')">Excluir</button>
    </article>
  `).join('');
}

async function loadOrders() {
  try {
    const data = await (await fetch('/api/orders', {
      headers: {
        'x-admin-password': pass()
      }
    })).json();

    if (!Array.isArray(data)) {
      orders.innerHTML = 'Digite a senha para ver pedidos.';
      return;
    }

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
            <strong>${i.name || 'Produto'}</strong><br>
            Quantidade: ${i.quantity || 1}<br>
            Valor: ${money(i.price || 0)}
          </li>
        `).join('')
        : '<li>Nenhum produto listado.</li>';

      return `
        <div class="order">
          <b>Pedido ${o.id}</b>

          <p><strong>Cliente:</strong> ${customer.name || '-'}</p>
          <p><strong>WhatsApp:</strong> ${customer.phone || '-'}</p>
          <p><strong>Forma de pagamento:</strong> ${customer.payment_label || customer.payment_method || '-'}</p>
          <p><strong>Status:</strong> ${o.status || '-'}</p>

          <p><strong>Subtotal:</strong> ${money(customer.subtotal || 0)}</p>
          <p><strong>Taxa:</strong> ${money(customer.fee_value || 0)}</p>
          <p><strong>Total:</strong> ${money(customer.total || 0)}</p>

          <p><strong>Produtos:</strong></p>
          <ul>
            ${itemsHtml}
          </ul>
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
      headers: {
        'x-admin-password': pass()
      }
    })).json();

    customers.innerHTML = Array.isArray(data) && data.length
      ? data.map(c => `
        <div class="order">
          <b>${c.name}</b>
          <p>E-mail: ${c.email}</p>
          <p>WhatsApp: ${c.phone}</p>
          <button onclick="delCustomer('${c.id}')">Excluir cliente</button>
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
  await loadProducts();
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
}

async function delProduct(id) {
  await fetch('/api/products/' + id, {
    method: 'DELETE',
    headers: {
      'x-admin-password': pass()
    }
  });

  adminMsg.textContent = 'Produto excluído!';
  await loadProducts();
}

async function delCustomer(id) {
  await fetch('/api/customers/' + id, {
    method: 'DELETE',
    headers: {
      'x-admin-password': pass()
    }
  });

  adminMsg.textContent = 'Cliente excluída!';
  await loadCustomers();
}

loadAdmin();
