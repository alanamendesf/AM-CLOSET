require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
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

function ensureFile(file, content) {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
  }
}

ensureFile('products.json', []);
ensureFile('orders.json', []);
ensureFile('customers.json', []);
ensureFile('config.json', {
  storeName: 'AM Closet',
  subtitle: 'Looks que valorizam você! ♡',
  whatsapp: '',
  instagram: '@useamcloseet'
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage });

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

/* CONFIGURAÇÕES */

app.get('/api/config', (req, res) => {
  res.json(readJson('config.json'));
});

app.put('/api/config', checkAdmin, (req, res) => {
  const config = {
    storeName: req.body.storeName || 'AM Closet',
    subtitle: req.body.subtitle || 'Looks que valorizam você! ♡',
    whatsapp: req.body.whatsapp || '',
    instagram: req.body.instagram || '@useamcloseet'
  };

  writeJson('config.json', config);
  res.json(config);
});

/* PRODUTOS */

app.get('/api/products', (req, res) => {
  res.json(readJson('products.json'));
});

app.post('/api/products', checkAdmin, (req, res) => {
  const products = readJson('products.json');

  const product = {
    id: String(Date.now()),
    name: req.body.name || '',
    price: Number(req.body.price || 0),
    category: req.body.category || 'Sem categoria',
    image: req.body.image || '/produto-1.svg',
    description: req.body.description || '',
    stock: Number(req.body.stock || 0),
    sizes: req.body.sizes || ''
  };

  products.push(product);
  writeJson('products.json', products);
  res.json(product);
});

app.put('/api/products/:id', checkAdmin, (req, res) => {
  const products = readJson('products.json');
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  products[index] = {
    ...products[index],
    name: req.body.name || '',
    price: Number(req.body.price || 0),
    category: req.body.category || 'Sem categoria',
    image: req.body.image || products[index].image,
    description: req.body.description || '',
    stock: Number(req.body.stock || 0),
    sizes: req.body.sizes || ''
  };

  writeJson('products.json', products);
  res.json(products[index]);
});

app.delete('/api/products/:id', checkAdmin, (req, res) => {
  const products = readJson('products.json').filter(p => p.id !== req.params.id);
  writeJson('products.json', products);
  res.json({ ok: true });
});

app.post('/api/upload', checkAdmin, upload.single('image'), (req, res) => {
  res.json({ image: '/uploads/' + req.file.filename });
});

/* CLIENTES */

app.post('/api/customers', async (req, res) => {
  const customer = {
    name: req.body.name || '',
    email: req.body.email || '',
    phone: req.body.phone || ''
  };

  if (!customer.name || !customer.email || !customer.phone) {
    return res.status(400).json({
      error: 'Preencha todos os dados.'
    });
  }

  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json({
    ok: true,
    customer: data
  });
});

app.get('/api/customers', checkAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});

app.delete('/api/customers/:id', checkAdmin, async (req, res) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json({
    ok: true
  });
});

/* PEDIDOS */

app.get('/api/orders', checkAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});


/* CHECKOUT MERCADO PAGO */

app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert([{
    customer: customer || {},
    items,
    status: 'Aguardando pagamento'
  }])
  .select()
  .single();

if (orderError) {
  return res.status(500).json({
    error: 'Erro ao salvar pedido.',
    details: orderError.message
  });
}

    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN.includes('COLE_')) {
      return res.json({
        demo: true,
        orderId: order.id,
        message: 'Pedido criado em modo teste. Configure Mercado Pago no Render.'
      });
    }

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const preference = new Preference(client);

const preferenceData = {
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
  external_reference: String(order.id),
  back_urls: {
    success: 'https://am-closet-1.onrender.com/sucesso.html',
    failure: 'https://am-closet-1.onrender.com/falha.html',
    pending: 'https://am-closet-1.onrender.com/pendente.html'
  },
  payment_methods: {
    installments: 12
  }
};

const result = await preference.create({
  body: preferenceData
});
    res.json({
      init_point: result.init_point,
      orderId: order.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erro ao criar checkout.',
      details: err.message
    });
  }
});

/* ROTAS */

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AM Closet rodando na porta ${PORT}`);
});
