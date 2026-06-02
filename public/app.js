let products = [];
let cart = [];
let config = {};

const money = v => Number(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

async function load() {
  config = await (await fetch('/api/config')).json();
  products = await (await fetch('/api/products')).json();

  renderConfig();
  renderProducts();
  renderCart();
}

function renderConfig() {
  storeNameText.textContent = config.storeName || 'AM Closet';
  subtitleText.textContent = config.subtitle || 'Moda feminina';

  footerStoreName.textContent = config.storeName || 'AM Closet';
  footerSubtitle.textContent = config.subtitle || 'Moda feminina';
  footerInstagram.textContent = config.instagram || '@amcloset';

  const number = (config.whatsapp || '').replace(/\D/g, '');
  const link = number ? `https://wa.me/55${number}` : '#';

  whatsappFloat.href = link;
  whatsappLinkTop.href = link;
}

function renderProducts() {
  document.getElementById('products').innerHTML = products.map(p => `
    <article class="card produto-card">
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.description || ''}</p>
      <b>${money(p.price)}</b>
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
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  document.getElementById('cartItems').innerHTML = cart.map(i => `
    <div class="cartline">
      <span>${i.quantity}x ${i.name}</span>
      <button onclick="removeItem('${i.id}')">x</button>
    </div>
  `).join('') || '<p>Carrinho vazio.</p>';

  document.getElementById('total').textContent = 'Total: ' + money(total);
}

async function checkout() {
  const msg = document.getElementById('msg');

  if (!cart.length) {
    msg.textContent = 'Seu carrinho está vazio.';
    return;
  }

  msg.textContent = 'Criando pedido...';

  const r = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      items: cart,
      customer: {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value
      }
    })
  });

  const data = await r.json();

  if (data.init_point) {
    location.href = data.init_point;
  } else {
    msg.textContent = data.message || data.error || 'Erro ao finalizar.';
  }
}

load();
