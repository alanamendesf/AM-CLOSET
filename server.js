require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.join(DATA_DIR, 'products.json'))) fs.writeFileSync(path.join(DATA_DIR, 'products.json'), '[]');
if (!fs.existsSync(path.join(DATA_DIR, 'orders.json'))) fs.writeFileSync(path.join(DATA_DIR, 'orders.json'), '[]');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

const upload = multer({ dest: UPLOAD_DIR });

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}
function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}
function checkAdmin(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD || pass === process.env.ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'Senha do painel inválida.' });
}

app.get('/api/config', (req, res) => {
  res.json({ storeName: process.env.STORE_NAME || 'AM Closet' });
});

app.get('/api/products', (req, res) => res.json(readJson('products.json')));

app.post('/api/products', checkAdmin, (req, res) => {
  const products = readJson('products.json');
  const product = {
    id: req.body.id || String(Date.now()),
    name: req.body.name,
    price: Number(req.body.price || 0),
    category: req.body.category || 'Roupas',
    image: req.body.image || '/produto-1.svg',
    description: req.body.description || '',
    stock: Number(req.body.stock || 0)
  };
  products.push(product);
  writeJson('products.json', products);
  res.json(product);
});

app.delete('/api/products/:id', checkAdmin, (req, res) => {
  const products = readJson('products.json').filter(p => p.id !== req.params.id);
  writeJson('products.json', products);
  res.json({ ok: true });
});

app.get('/api/orders', checkAdmin, (req, res) => res.json(readJson('orders.json')));

app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Carrinho vazio.' });

    const orders = readJson('orders.json');
    const order = {
      id: String(Date.now()),
      customer: customer || {},
      items,
      status: 'Aguardando pagamento',
      createdAt: new Date().toISOString()
    };
    orders.push(order);
    writeJson('orders.json', orders);

    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN.includes('COLE_')) {
      return res.json({
        demo: true,
        orderId: order.id,
        message: 'Pedido criado em modo teste. Configure MERCADO_PAGO_ACCESS_TOKEN no Render para ativar Pix/cartão.'
      });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: items.map(i => ({
          title: i.name,
          quantity: Number(i.quantity || 1),
          unit_price: Number(i.price),
          currency_id: 'BRL'
        })),
        payer: {
          name: customer?.name || '',
          email: customer?.email || ''
        },
        external_reference: order.id,
        back_urls: {
          success: `${req.protocol}://${req.get('host')}/sucesso.html`,
          failure: `${req.protocol}://${req.get('host')}/falha.html`,
          pending: `${req.protocol}://${req.get('host')}/pendente.html`
        },
        auto_return: 'approved'
      }
    });
    res.json({ init_point: result.init_point, orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar checkout.', details: err.message });
  }
});

app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.listen(PORT, () => console.log(`AM Closet rodando na porta ${PORT}`));
