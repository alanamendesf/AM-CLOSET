require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const SITE_URL = process.env.SITE_URL || 'https://am-closet-1.onrender.com';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(file, content) {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
  }
}

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

const upload = multer({
  storage: multer.memoryStorage()
});

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

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getPaymentFee() {
  return 0.0498;
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

/* PRODUTOS NO SUPABASE */

app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'Erro ao carregar produtos.',
      details: error.message
    });
  }

  res.json(data || []);
});

app.post('/api/products', checkAdmin, async (req, res) => {
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

  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Erro ao salvar produto.',
      details: error.message
    });
  }

  res.json(data);
});

app.put('/api/products/:id', checkAdmin, async (req, res) => {
  const product = {
    name: req.body.name || '',
    price: Number(req.body.price || 0),
    category: req.body.category || 'Sem categoria',
    image: req.body.image || '/produto-1.svg',
    description: req.body.description || '',
    stock: Number(req.body.stock || 0),
    sizes: req.body.sizes || ''
  };

  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Erro ao editar produto.',
      details: error.message
    });
  }

  res.json(data);
});

app.delete('/api/products/:id', checkAdmin, async (req, res) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: 'Erro ao excluir produto.',
      details: error.message
    });
  }

  res.json({ ok: true });
});

/* UPLOAD PERMANENTE NO SUPABASE STORAGE */

app.post('/api/upload', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const fileName = `produto-${Date.now()}${ext}`;

    const { error } = await supabaseAdmin.storage
      .from('products')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) {
      return res.status(500).json({
        error: 'Erro ao enviar imagem.',
        details: error.message
      });
    }

    const { data } = supabaseAdmin.storage
      .from('products')
      .getPublicUrl(fileName);

    res.json({
      image: data.publicUrl
    });

  } catch (err) {
    res.status(500).json({
      error: 'Erro no upload da imagem.',
      details: err.message
    });
  }
});

/* CLIENTES */

app.post('/api/customers', async (req, res) => {
  const customer = {
    name: req.body.name || '',
    email: req.body.email || '',
    phone: req.body.phone || ''
  };

  if (!customer.name || !customer.phone) {
    return res.status(400).json({ error: 'Preencha nome e WhatsApp.' });
  }

  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true, customer: data });
});

app.get('/api/customers', checkAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('id', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

app.delete('/api/customers/:id', checkAdmin, async (req, res) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

/* PEDIDOS */

app.get('/api/orders', checkAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});

/* PEDIDOS VIA WHATSAPP */

app.post('/api/orders/whatsapp', async (req, res) => {
  try {
    const {
      customer,
      items,
      payment_method,
      payment_label,
      subtotal,
      fee_value,
      total,
      status
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

    const customerData = {
      ...(customer || {}),
      payment_method: payment_method || '',
      payment_label: payment_label || '',
      subtotal: Number(subtotal || 0),
      fee_value: Number(fee_value || 0),
      total: Number(total || 0),
      source: 'whatsapp'
    };

    const orderItems = items.map(i => ({
      id: i.id || '',
      name: i.name || '',
      quantity: Number(i.quantity || 1),
      price: Number(i.price || 0),
      image: i.image || '',
      size: i.size || '',
      category: i.category || ''
    }));

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        customer: customerData,
        items: orderItems,
        status: status || 'Aguardando confirmação'
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Erro ao salvar pedido via WhatsApp.',
        details: error.message
      });
    }

    res.json({
      ok: true,
      orderId: order.id,
      order
    });

  } catch (err) {
    res.status(500).json({
      error: 'Erro ao criar pedido via WhatsApp.',
      details: err.message
    });
  }
});

/* CHECKOUT MERCADO PAGO - CARTÃO DE CRÉDITO */

app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Carrinho vazio.' });
    }

    const method = 'credit';
    const feePercent = getPaymentFee();

    const subtotal = items.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.quantity || 1);
    }, 0);

    const feeValue = roundMoney(subtotal * feePercent);
    const total = roundMoney(subtotal + feeValue);

    const orderItems = items.map(i => ({
      id: i.id || '',
      name: i.name,
      quantity: Number(i.quantity || 1),
      price: Number(i.price || 0),
      image: i.image || '',
      category: i.category || '',
      size: i.size || ''
    }));

    const customerData = {
      ...(customer || {}),
      payment_method: method,
      payment_label: 'Cartão de Crédito',
      subtotal,
      fee_percent: feePercent * 100,
      fee_value: feeValue,
      total,
      source: 'mercado_pago'
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer: customerData,
        items: orderItems,
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
        subtotal,
        feeValue,
        total,
        message: 'Pedido criado em modo teste. Configure Mercado Pago no Render.'
      });
    }

    const preferenceItems = items.map(i => ({
      title: i.name,
      quantity: Number(i.quantity || 1),
      unit_price: roundMoney(Number(i.price || 0)),
      currency_id: 'BRL'
    }));

    preferenceItems.push({
      title: 'Taxa Mercado Pago - Cartão de Crédito 4,98%',
      quantity: 1,
      unit_price: feeValue,
      currency_id: 'BRL'
    });

    const preferenceData = {
      items: preferenceItems,
      payer: {
        name: customer?.name || '',
        email: customer?.email || ''
      },
      external_reference: String(order.id),
      notification_url: `${SITE_URL}/api/webhook/mercadopago`,
      back_urls: {
        success: `${SITE_URL}/sucesso.html`,
        failure: `${SITE_URL}/falha.html`,
        pending: `${SITE_URL}/pendente.html`
      },
      auto_return: 'approved',
      payment_methods: {
        installments: 12,
        excluded_payment_methods: [
          { id: 'pix' }
        ],
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
          { id: 'debit_card' }
        ]
      }
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    });

    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', result);
      return res.status(500).json({
        error: 'Erro Mercado Pago.',
        details: result.message || result
      });
    }

    res.json({
      init_point: result.init_point,
      orderId: order.id,
      subtotal,
      feeValue,
      total
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erro ao criar checkout.',
      details: err.message
    });
  }
});

/* WEBHOOK MERCADO PAGO */

app.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const body = req.body;

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split('/').pop();

    if (!paymentId || !process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      return res.json({ ok: true });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
      }
    });

    const paymentData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Erro ao consultar pagamento:', paymentData);
      return res.json({ ok: false });
    }

    const orderId = paymentData.external_reference;

    if (!orderId) {
      return res.json({ ok: true });
    }

    let status = 'Aguardando pagamento';

    if (paymentData.status === 'approved') {
      status = 'Pago';
    } else if (paymentData.status === 'pending') {
      status = 'Pagamento pendente';
    } else if (paymentData.status === 'rejected') {
      status = 'Pagamento recusado';
    } else if (paymentData.status === 'cancelled') {
      status = 'Pagamento cancelado';
    }

    await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    res.json({ ok: true });

  } catch (err) {
    console.error('Erro no webhook Mercado Pago:', err.message);
    res.json({ ok: false });
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
