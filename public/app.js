let products = [];
let cart = [];
let config = {};
let selectedCategory = 'Todos';

const money = v => Number(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getSelectedPaymentMethod() {
  return document.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';
}

function getPaymentFeePercent() {
  const paymentMethod = getSelectedPaymentMethod();

  if (paymentMethod === 'pix') {
    return 0.0099;
  }

  return 0.0498;
}

function getPaymentLabel() {
  const paymentMethod = getSelectedPaymentMethod();

  if (paymentMethod === 'pix') {
    return 'PIX';
  }

  return 'Cartão';
}

async function load() {
  try {
    config = await (await fetch('/api/config')).json();
    products = await (await fetch('/api/products')).json();

    renderConfig();
    renderCategories();
    renderProducts();
    renderCart();

    document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
      input.addEventListener('change', renderCart);
    });
  } catch (error) {
    console.error(error);
    document.getElementById('products').innerHTML = '<p>Erro ao carregar produtos.</p>';
  }
}

function renderConfig() {
  if (document.getElementById('storeNameText')) {
    storeNameText.textContent = config.storeName || 'AM Closet';
  }

  if (document.getElementById('footerStoreName')) {
    footerStoreName.textContent = config.storeName || 'AM Closet';
  }

  if (document.getElementById('footerInstagram')) {
    footerInstagram.textContent = '@useamcloseet';
  }

  const number = (config.whatsapp || '').replace(/\D/g, '');
  const link = number ? `https://wa.me/55${number}` : '#';

  if (document.getElementById('whatsappFloat')) {
    whatsappFloat.href = link;
  }
}

function renderCategories() {
  const area = document.getElementById('categoryTabs');
  if (!area) return;

  const categories = ['Todos', ...new Set(products.map(p => p.category || 'Sem categoria'))];

  area.innerHTML = categories.map(cat => `
    <button class="${selectedCategory === cat ? 'categoria-ativa' : ''}" onclick="selectCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function selectCategory(category) {
  selectedCategory = category;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const area = document.getElementById('products');

  let filteredProducts = products;

  if (selectedCategory !== 'Todos') {
    filteredProducts = products.filter(p => (p.category || 'Sem categoria') === selectedCategory);
  }

  if (!filteredProducts.length) {
    area.innerHTML = '<p>Nenhum produto nessa categoria.</p>';
    return;
  }

  area.innerHTML = filteredProducts.map(p => `
    <article class="card produto-card">
      <img src="${p.image || '/produto-1.svg'}" alt="${p.name}" onerror="this.src='/produto-1.svg'">
      <h3>${p.name}</h3>
      <p>${p.description || ''}</p>
      <b>${money(p.price)}</b>
      <small>Categoria: ${p.category || 'Sem categoria'}</small>
      <small>Tamanhos: ${p.sizes || 'Consultar'}</small>
      <small>Estoque: ${p.stock}</small>
      <button onclick="add('${p.id}')">Adicionar ao carrinho</button>
    </article>
  `).join('');
}

function add(id) {
  const p = products.find(x => x.id === id);

  if (!p || Number(p.stock) <= 0) {
    alert('Produto sem estoque.');
    return;
  }

  const item = cart.find(x => x.id === id);

  if (item) {
    if (item.quantity >= Number(p.stock)) {
      alert('Quantidade maior que o estoque disponível.');
      return;
    }
    item.quantity++;
  } else {
    cart.push({ ...p, quantity: 1 });
  }

  renderCart();
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

function renderCart() {
  const subtotal = cart.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  const feePercent = getPaymentFeePercent();
  const feeValue = roundMoney(subtotal * feePercent);
  const total = roundMoney(subtotal + feeValue);
  const quantidadeItens = cart.reduce((s, i) => s + Number(i.quantity), 0);

  if (document.getElementById('cartCount')) {
    document.getElementById('cartCount').textContent = quantidadeItens;
  }

  document.getElementById('cartItems').innerHTML =
    cart.map(i => `
      <div class="cartline">
        <div class="cart-produto-info">
          <img src="${i.image || '/produto-1.svg'}" onerror="this.src='/produto-1.svg'">
          <div>
            <strong>${i.name}</strong><br>
            <small>${i.quantity}x ${money(i.price)}</small>
          </div>
        </div>

        <button onclick="removeItem('${i.id}')">x</button>
      </div>
    `).join('') || '<p>Carrinho vazio.</p>';

  if (!cart.length) {
    document.getElementById('total').textContent = 'Total: R$ 0,00';
    return;
  }

  document.getElementById('total').innerHTML = `
    Subtotal: ${money(subtotal)}<br>
    Taxa ${getPaymentLabel()}: ${money(feeValue)}<br>
    Total: ${money(total)}
  `;
}

async function saveClient() {
  const msg = document.getElementById('clientMsg');

  const body = {
    name: document.getElementById('clientName').value,
    email: document.getElementById('clientEmail').value,
    phone: document.getElementById('clientPhone').value
  };

  if (!body.name || !body.email || !body.phone) {
    msg.textContent = 'Preencha nome, e-mail e WhatsApp.';
    return;
  }

  const r = await fetch('/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await r.json();

  msg.textContent = data.error || 'Cadastro realizado com sucesso!';

  if (!data.error) {
    document.getElementById('clientName').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientPhone').value = '';
  }
}

async function checkout() {
  const msg = document.getElementById('msg');

  if (!cart.length) {
    msg.textContent = 'Seu carrinho está vazio.';
    return;
  }

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const paymentMethod = getSelectedPaymentMethod();

  if (!name || !email) {
    msg.textContent = 'Preencha nome e e-mail antes de finalizar.';
    return;
  }

  msg.textContent = 'Criando pedido...';

  try {
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: cart,
        paymentMethod: paymentMethod,
        customer: {
          name: name,
          email: email
        }
      })
    });

    const data = await r.json();

    if (!r.ok) {
      msg.textContent =
        data.details ||
        data.message ||
        data.error ||
        'Erro ao finalizar.';
      console.error('Erro checkout:', data);
      return;
    }

    if (data.init_point) {
      window.location.href = data.init_point;
      return;
    }

    msg.textContent =
      data.details ||
      data.message ||
      data.error ||
      'Erro ao finalizar.';
  } catch (error) {
    msg.textContent = 'Erro ao conectar com o checkout.';
    console.error(error);
  }
}

load();
