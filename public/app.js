let products = [];
let cart = [];
let config = {};
let selectedCategory = 'Todos';

const money = v => Number(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

async function load() {
  try {
    config = await (await fetch('/api/config')).json();
    products = await (await fetch('/api/products')).json();

    renderConfig();
    renderCategories();
    renderProducts();
    renderCart();
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
  const total = cart.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
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

  document.getElementById('total').textContent = 'Total: ' + money(total);
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

  msg.textContent = 'Criando pedido...';

  try {
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
      msg.textContent = data.details || data.message || data.error || 'Erro ao finalizar.';
    }
  } catch (error) {
    msg.textContent = 'Erro ao conectar com o checkout.';
    console.error(error);
  }
}

load();
