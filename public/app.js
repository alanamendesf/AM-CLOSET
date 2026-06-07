let products = [];
let cart = JSON.parse(localStorage.getItem('amcloset_cart') || '[]');
let config = {};
let selectedCategory = 'Todos';

const STORE_WHATSAPP = '85991346349';

const money = v => Number(v || 0).toLocaleString('pt-BR', {
style: 'currency',
currency: 'BRL'
});

function saveCart() {
localStorage.setItem('amcloset_cart', JSON.stringify(cart));
}

function clearCart() {
cart = [];
localStorage.removeItem('amcloset_cart');
renderCart();
}

function roundMoney(value) {
return Math.round(Number(value) * 100) / 100;
}

function getSelectedPaymentMethod() {
return document.querySelector('input[name="paymentMethod"]:checked')?.value || 'credit';
}

function getPaymentFeePercent() {
const paymentMethod = getSelectedPaymentMethod();

if (paymentMethod === 'credit' || paymentMethod === 'debit') {
return 0.0498;
}

return 0;
}

function getPaymentLabel() {
const paymentMethod = getSelectedPaymentMethod();

if (paymentMethod === 'pix') return 'PIX';
if (paymentMethod === 'cash') return 'Dinheiro em espécie';
if (paymentMethod === 'debit') return 'Cartão de Débito';
if (paymentMethod === 'credit') return 'Cartão de Crédito';

return 'Cartão de Crédito';
}

async function load() {
try {
const configResponse = await fetch('/api/config');
config = await configResponse.json();


const productsResponse = await fetch('/api/products');
const productsData = await productsResponse.json();

if (!productsResponse.ok || !Array.isArray(productsData)) {
  console.error('Erro ao carregar produtos:', productsData);

  if (document.getElementById('products')) {
    document.getElementById('products').innerHTML =
      `<p>Erro ao carregar produtos: ${productsData.details || productsData.error || 'verifique a tabela products no Supabase.'}</p>`;
  }

  products = [];
} else {
  products = productsData.map(p => ({
    ...p,
    id: String(p.id),
    price: Number(p.price || 0),
    stock: Number(p.stock || 0)
  }));
}

renderConfig();
renderCategories();
renderProducts();
renderCart();

document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
  input.addEventListener('change', renderCart);
});

  document.querySelectorAll('input[name="shippingMethod"]').forEach(input => {
  input.addEventListener('change', renderCart);
});
  

} catch (error) {
console.error(error);


if (document.getElementById('products')) {
  document.getElementById('products').innerHTML = '<p>Erro ao carregar produtos.</p>';
}


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

const link = `https://wa.me/55${STORE_WHATSAPP}`;

if (document.getElementById('whatsappFloat')) {
whatsappFloat.href = link;
}
}

function renderCategories() {
const area = document.getElementById('categoryTabs');
if (!area) return;

const categories = ['Todos', ...new Set(products.map(p => p.category || 'Sem categoria'))];

area.innerHTML = categories.map(cat => `     <button class="${selectedCategory === cat ? 'categoria-ativa' : ''}" onclick="selectCategory('${cat}')">
      ${cat}     </button>
  `).join('');
}

function selectCategory(category) {
  selectedCategory = category;
  renderCategories();
  renderProducts();
  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderProductCard(p) {
  const isSoldOut = Number(p.stock || 0) <= 0;

  return `
    <article class="card produto-card ${isSoldOut ? 'produto-card-esgotado' : ''}">
      <img src="${p.image || '/produto-1.svg'}" alt="${p.name || 'Produto'}" onerror="this.src='/produto-1.svg'">

      <div class="card-body">
        <h3>${p.name || 'Produto'}</h3>
        <p>${p.description || ''}</p>
        <b>${money(p.price || 0)}</b>
        <small>Categoria: ${p.category || 'Sem categoria'}</small>
        <small>Tamanhos: ${p.sizes || 'Consultar'}</small>

        ${
          isSoldOut
            ? `
              <small class="produto-esgotado">Esgotado</small>
              <button disabled class="btn-esgotado">Esgotado</button>
            `
            : `
              <small>Estoque: ${p.stock || 0}</small>
              <button onclick="add('${p.id}')">Adicionar ao carrinho</button>
            `
        }
      </div>
    </article>
  `;
}

function renderProducts() {
  const area = document.getElementById('products');
  if (!area) return;

  const premiumSection = document.getElementById('premiumSection');
  const premiumProductsArea = document.getElementById('premiumProducts');

  const premiumProducts = products.filter(p =>
    String(p.category || '').trim().toUpperCase() === 'AMCLOSET PREMIUM'
  );

  if (premiumSection && premiumProductsArea) {
    if (premiumProducts.length) {
      premiumSection.classList.remove('hidden');
      premiumProductsArea.innerHTML = premiumProducts.map(renderProductCard).join('');
    } else {
      premiumSection.classList.add('hidden');
      premiumProductsArea.innerHTML = '';
    }
  }

  let filteredProducts = products;

  if (selectedCategory === 'Todos') {
    filteredProducts = products.filter(p =>
      String(p.category || '').trim().toUpperCase() !== 'AMCLOSET PREMIUM'
    );
  } else {
    filteredProducts = products.filter(p =>
      (p.category || 'Sem categoria') === selectedCategory
    );
  }

  if (!filteredProducts.length) {
    area.innerHTML = '<p class="texto-centro">Nenhum produto nessa categoria.</p>';
    return;
  }

  area.innerHTML = filteredProducts.map(renderProductCard).join('');
}
  
function add(id) {
const p = products.find(x => String(x.id) === String(id));

if (!p || Number(p.stock) <= 0) {
alert('Produto sem estoque.');
return;
}

const item = cart.find(x => String(x.id) === String(id));

if (item) {
if (item.quantity >= Number(p.stock)) {
alert('Quantidade maior que o estoque disponível.');
return;
}


item.quantity++;


} else {
cart.push({ ...p, quantity: 1 });
}

saveCart();
renderCart();
openCartModal();
}

function removeItem(id) {
cart = cart.filter(i => String(i.id) !== String(id));
saveCart();
renderCart();
}

function getSelectedShippingMethod() {
  return document.querySelector('input[name="shippingMethod"]:checked')?.value || 'pickup';
}

function getShippingValue(subtotal) {
  const shippingMethod = getSelectedShippingMethod();

  if (shippingMethod === 'pickup') {
    return 0;
  }

  if (shippingMethod === 'fortaleza') {
    return subtotal >= 200 ? 0 : 15;
  }

  if (shippingMethod === 'metro') {
    return 20;
  }

  if (shippingMethod === 'national') {
    return 0;
  }

  return 0;
}

function getCartTotals() {
  const subtotal = cart.reduce(
    (s, i) => s + Number(i.price) * Number(i.quantity),
    0
  );

  const feePercent = getPaymentFeePercent();
  const feeValue = roundMoney(subtotal * feePercent);

  const shippingValue = getShippingValue(subtotal);

  const total = roundMoney(
    subtotal +
    feeValue +
    shippingValue
  );

  return {
    subtotal,
    feeValue,
    shippingValue,
    total
  };
}

function renderCart() {
saveCart();

const {
  subtotal,
  feeValue,
  shippingValue,
  total
} = getCartTotals();
  
const quantidadeItens = cart.reduce((s, i) => s + Number(i.quantity), 0);
const paymentMethod = getSelectedPaymentMethod();

if (document.getElementById('cartCount')) {
document.getElementById('cartCount').textContent = quantidadeItens;
}

if (!document.getElementById('cartItems') || !document.getElementById('total')) {
return;
}

document.getElementById('cartItems').innerHTML =
cart.map(i => ` <div class="cartline"> <div class="cart-produto-info"> <img src="${i.image || '/produto-1.svg'}" onerror="this.src='/produto-1.svg'"> <div> <strong>${i.name}</strong><br> <small>${i.quantity}x ${money(i.price)}</small> </div> </div>


    <button onclick="removeItem('${i.id}')">x</button>
  </div>
`).join('') || '<p>Carrinho vazio.</p>';


if (!cart.length) {
document.getElementById('total').textContent = 'Total: R$ 0,00';
return;
}

if (paymentMethod === 'credit' || paymentMethod === 'debit') {
document.getElementById('total').innerHTML = `
  Subtotal: ${money(subtotal)}<br>
  <small>Taxa Mercado Pago 4,98%: ${money(feeValue)}</small><br>
  <small>Frete: ${money(shippingValue)}</small><br>
  Total: ${money(total)}
`;
  
} else {
document.getElementById('total').innerHTML = `
  Subtotal: ${money(subtotal)}<br>
  <small>Frete: ${money(shippingValue)}</small><br>
  Forma de pagamento: ${getPaymentLabel()}<br>
  Total: ${money(total)}
`;
  
}
}

async function saveClient() {
const msg = document.getElementById('clientMsg');

const body = {
name: document.getElementById('clientName').value,
email: document.getElementById('clientEmail')?.value.trim() || '',
phone: document.getElementById('clientPhone').value
};

if (!body.name || !body.phone) {
msg.textContent = 'Preencha nome e WhatsApp.';
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
document.getElementById('clientPhone').value = '';


if (document.getElementById('clientEmail')) {
  document.getElementById('clientEmail').value = '';
}


}
}

async function saveWhatsappOrderToPanel(name, phone, paymentMethod, email) {
const {
  subtotal,
  feeValue,
  shippingValue,
  total
} = getCartTotals();

try {
await fetch('/api/orders/whatsapp', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({
customer: {
name: name,
phone: phone,
email: email || ''
},
items: cart.map(item => ({
id: item.id,
name: item.name,
quantity: Number(item.quantity || 1),
price: Number(item.price || 0),
image: item.image || '',
size: item.size || '',
category: item.category || ''
})),
payment_method: paymentMethod,
payment_label: getPaymentLabel(),
subtotal: subtotal,
fee_value: feeValue,
total: total,
status: 'Aguardando confirmação'
})
});
} catch (error) {
console.error('Erro ao salvar pedido no painel:', error);
}
}

function sendOrderToWhatsapp(name, phone, paymentMethod) {
  const {
    subtotal,
    feeValue,
    shippingValue,
    total
  } = getCartTotals();

  const shippingMethod = getSelectedShippingMethod();

  let shippingText = 'Retirada gratuita';

  if (shippingMethod === 'fortaleza') {
    shippingText = 'Entrega em Fortaleza';
  }

  if (shippingMethod === 'metro') {
    shippingText = 'Entrega na Região Metropolitana';
  }

  if (shippingMethod === 'national') {
    shippingText = 'Outras cidades do Brasil - Melhor Envio';
  }

  const itensTexto = cart.map((item, index) => {
    const itemTotal = Number(item.price) * Number(item.quantity);

    return `${index + 1}. ${item.name}

Quantidade: ${item.quantity}
Valor unitário: ${money(item.price)}
Total do item: ${money(itemTotal)}`;
  }).join('\n\n');

  const taxaTexto =
    paymentMethod === 'credit' || paymentMethod === 'debit'
      ? `Taxa Mercado Pago 4,98%: ${money(feeValue)}\n`
      : '';

  const mensagem = `🌷 Olá, AM Closet!

Gostaria de finalizar meu pedido. ✨

━━━━━━━━━━━━━━━
👤 DADOS DA CLIENTE
━━━━━━━━━━━━━━━

Nome: ${name}
WhatsApp: ${phone}

━━━━━━━━━━━━━━━
🛍️ ITENS DO PEDIDO
━━━━━━━━━━━━━━━

${itensTexto}

━━━━━━━━━━━━━━━
💳 RESUMO DO PEDIDO
━━━━━━━━━━━━━━━

Subtotal: ${money(subtotal)}
${taxaTexto}Frete: ${money(shippingValue)}
Total: ${money(total)}

━━━━━━━━━━━━━━━
💰 FORMA DE PAGAMENTO
━━━━━━━━━━━━━━━

${getPaymentLabel()}

━━━━━━━━━━━━━━━
🚚 FORMA DE ENTREGA
━━━━━━━━━━━━━━━

${shippingText}

Aguardo a confirmação do pedido.

Muito obrigada! 💖`;

  const url = `https://wa.me/55${STORE_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;

  window.location.href = url;
}

async function checkout() {
const msg = document.getElementById('msg');

if (!cart.length) {
msg.textContent = 'Seu carrinho está vazio.';
return;
}

const name = document.getElementById('name').value.trim();
const phone = document.getElementById('phone').value.trim();
const email = document.getElementById('email')?.value.trim() || '';
const paymentMethod = getSelectedPaymentMethod();

if (!name || !phone) {
msg.textContent = 'Preencha nome e WhatsApp antes de finalizar.';
return;
}

if (paymentMethod === 'pix' || paymentMethod === 'cash' || paymentMethod === 'debit') {
msg.textContent = 'Salvando pedido e abrindo WhatsApp...';


const cartBackup = [...cart];

await saveWhatsappOrderToPanel(name, phone, paymentMethod, email);
sendOrderToWhatsapp(name, phone, paymentMethod);

cart = cartBackup;
saveCart();

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
paymentMethod: 'card',
customer: {
name: name,
email: email,
phone: phone
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

function openCartModal() {
document.getElementById('cartModal')?.classList.add('ativo');
}

function closeCartModal() {
document.getElementById('cartModal')?.classList.remove('ativo');
}

function continueShopping() {
closeCartModal();
window.location.href = '/';
}

function goToCart() {
closeCartModal();
window.location.href = '/carrinho.html';
}

load();

