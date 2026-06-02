let products = [];
let cart = [];
let config = {};

const money = v => Number(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

async function load() {
  try {
    config = await (await fetch('/api/config')).json();
    products = await (await fetch('/api/products')).json();

    console.log('Produtos carregados:', products);

    renderConfig();
    renderProducts();
    renderCart();
  } catch (error) {
    console.error('Erro ao carregar loja:', error);
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

function renderProducts() {
  const area = document.getElementById('products');

  if (!products || !products.length) {
    area.innerHTML = '<p>Nenhum produto cadastrado.</p>';
    return;
  }

  area.innerHTML = products.map(p => {
    const image = p.image || '/produto-1.svg';

    return `
      <article class="card produto-card">
        <img src="${image}" alt="${p.name}" onerror="this.src='/produto-1.svg'">
        <h3>${p.name}</h3>
        <p>${p.description || ''}</p>
        <b>${money(p.price)}</b>
        <small>Tamanhos: ${p.sizes || 'Consultar'}</small>
        <small>Estoque: ${p.stock}</small>
        <button onclick="add('${p.id}')">Adicionar ao carrinho</button>
      </article>
    `;
  }).join('');
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
  const total = cart.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);

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
