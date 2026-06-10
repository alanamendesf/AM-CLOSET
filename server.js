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
  subtitle: 'Looks que valorizam você!',
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

  if (!process.env.ADMIN_PASSWORD || pass === process.env.ADMIN_PASSWORD) {
    return next();
  }

  return res.status(401).json({ error: 'Senha do painel inválida.' });
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function getPaymentFee() {
  return 0.0498;
}

function generateOrderCode() {
  return 'AM' + Math.floor(10000 + Math.random() * 90000);
}

function getNotificationEmails() {
  return (
    process.env.ORDER_NOTIFICATION_EMAILS ||
    'alanavictoriaf@gmail.com,alanavvictoria@icloud.com,andressapereira191116@gmail.com'
  )
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function getOrderCode(order) {
  return order?.customer?.order_code || order?.id || 'Pedido';
}

function getCustomerName(order) {
  return order?.customer?.name || 'cliente';
}

function getCustomerEmail(order) {
  return order?.customer?.email || '';
}

function getProductFinalPrice(product) {
  const price = Number(product.price || 0);
  const promoPrice = Number(product.promo_price || 0);
  const isPromo = Boolean(product.is_promo);

  if (isPromo && promoPrice > 0 && promoPrice < price) {
    return promoPrice;
  }

  return price;
}

function productHasPromotion(product) {
  const price = Number(product.price || 0);
  const promoPrice = Number(product.promo_price || 0);

  return Boolean(product.is_promo) && promoPrice > 0 && promoPrice < price;
}

async function getCouponByCode(code) {
  if (!code) return null;

  const cleanCode = String(code).trim().toUpperCase();

  if (!cleanCode) return null;

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', cleanCode)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar cupom:', error.message);
    return null;
  }

  return data || null;
}

function calculateCouponDiscount(subtotal, coupon) {
  if (!coupon) return 0;

  const percent = Number(coupon.discount_percent || 0);
  const fixed = Number(coupon.discount_value || 0);

  if (percent > 0) {
    return roundMoney(Number(subtotal || 0) * (percent / 100));
  }

  if (fixed > 0) {
    return roundMoney(Math.min(Number(subtotal || 0), fixed));
  }

  return 0;
}

async function sendCustomerEmail({ to, subject, html }) {
  try {
    if (!process.env.RESEND_API_KEY || !to) return;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'AM Closet <onboarding@resend.dev>',
        to,
        subject,
        html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro ao enviar e-mail para cliente:', result);
    }
  } catch (error) {
    console.error('Erro no e-mail da cliente:', error.message);
  }
}

function emailLayout(title, content) {
  return `
    <div style="background:#f7eee9;padding:32px 16px;font-family:Arial,sans-serif;color:#2b2724;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;">
        <h1 style="margin:0;color:#8b5e4b;text-align:center;">AM Closet</h1>
        <p style="text-align:center;color:#9b7b6c;">Looks que valorizam você!</p>

        <h2 style="color:#8b5e4b;">${title}</h2>

        ${content}

        <p style="margin-top:28px;">Equipe AM Closet</p>
      </div>
    </div>
  `;
}

function whatsappButton(text) {
  const whatsappNumber = '5585991346349';
  const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

  return `
    <p style="text-align:center;margin:28px 0;">
      <a href="${link}" target="_blank" style="background:#25D366;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold;display:inline-block;">
        Falar com a AM Closet no WhatsApp
      </a>
    </p>
  `;
}

async function sendPaymentRejectedCreditEmail(order) {
  const customer = order.customer || {};
  const orderCode = getOrderCode(order);
  const customerEmail = getCustomerEmail(order);

  if (!customerEmail) return;

  const html = emailLayout(
    'Pagamento não aprovado',
    `
      <p>Olá, <strong>${customer.name || 'cliente'}</strong>!</p>

      <p>Não conseguimos confirmar o pagamento no cartão informado.</p>

      <div style="background:#f7eee9;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Número do Pedido:</strong> ${orderCode}</p>
        <p><strong>Total:</strong> ${formatMoney(customer.total || 0)}</p>
      </div>

      <p>Isso pode acontecer por limite insuficiente, dados incorretos ou bloqueio de segurança da operadora.</p>

      <p>Você pode tentar novamente com outro cartão ou escolher pagamento via Pix.</p>

      ${whatsappButton(`Olá! Preciso de ajuda com o pagamento recusado do meu pedido ${orderCode} da AM Closet.`)}
    `
  );

  await sendCustomerEmail({
    to: customerEmail,
    subject: `Pagamento não aprovado - Pedido ${orderCode}`,
    html
  });
}

async function sendPaymentApprovedEmail(order) {
  const customer = order.customer || {};
  const orderCode = getOrderCode(order);
  const customerEmail = getCustomerEmail(order);

  if (!customerEmail) return;

  const html = emailLayout(
    'Pagamento aprovado!',
    `
      <p>Olá, <strong>${customer.name || 'cliente'}</strong>!</p>

      <p>Seu pagamento foi confirmado e seu pedido já entrou em preparação.</p>

      <div style="background:#f7eee9;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Número do Pedido:</strong> ${orderCode}</p>
        <p><strong>Total:</strong> ${formatMoney(customer.total || 0)}</p>
      </div>

      <p>Agora é só aguardar! Em breve enviaremos novas atualizações sobre sua compra.</p>

      <p>Obrigada por comprar na AM Closet!</p>

      ${whatsappButton(`Olá! Tenho uma dúvida sobre meu pedido ${orderCode} da AM Closet.`)}
    `
  );

  await sendCustomerEmail({
    to: customerEmail,
    subject: `Pagamento aprovado - Pedido ${orderCode}`,
    html
  });
}

async function sendCancelOrderEmail(order, reason) {
  const customer = order.customer || {};
  const orderCode = getOrderCode(order);
  const customerEmail = getCustomerEmail(order);

  if (!customerEmail) return;

  const html = emailLayout(
    'Pedido cancelado',
    `
      <p>Olá, <strong>${customer.name || 'cliente'}</strong>.</p>

      <p>Sentimos muito, mas seu pedido precisou ser cancelado.</p>

      <div style="background:#f7eee9;border-radius:12px;padding:16px;margin:20px 0;">
        <p><strong>Número do Pedido:</strong> ${orderCode}</p>
        <p><strong>Motivo:</strong><br>${reason}</p>
      </div>

      <p>Se tiver qualquer dúvida, fale diretamente com a gente pelo WhatsApp.</p>

      ${whatsappButton(`Olá! Tenho uma dúvida sobre o cancelamento do meu pedido ${orderCode} da AM Closet.`)}

      <p>Agradecemos sua compreensão e esperamos atendê-la novamente em breve.</p>
    `
  );

  await sendCustomerEmail({
    to: customerEmail,
    subject: `Pedido cancelado - ${orderCode}`,
    html
  });
}

async function sendNewOrderEmail(order) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('RESEND_API_KEY não configurada. E-mail não enviado.');
      return;
    }

    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const orderCode = customer.order_code || order.id;

    const itemsHtml = items.map(item => `
      <li style="margin-bottom:12px;">
        <strong>${item.name || 'Produto'}</strong><br>
        Quantidade: ${item.quantity || 1}<br>
        Valor: ${formatMoney(item.price || 0)}
      </li>
    `).join('');

    const customerWhatsapp = String(customer.phone || '').replace(/\D/g, '');
    const finalPhone = customerWhatsapp.startsWith('55')
      ? customerWhatsapp
      : '55' + customerWhatsapp;

    const whatsappClientButton = customerWhatsapp
      ? `
        <p style="text-align:center;margin:28px 0;">
          <a href="https://wa.me/${finalPhone}" target="_blank" style="background:#25D366;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold;display:inline-block;">
            Chamar cliente no WhatsApp
          </a>
        </p>
      `
      : '';

    const html = emailLayout(
      'Novo pedido recebido!',
      `
        <p>Um novo pedido foi realizado na AM Closet.</p>

        <div style="background:#f7eee9;border-radius:12px;padding:16px;margin:20px 0;">
          <p><strong>Pedido:</strong> ${orderCode}</p>
          <p><strong>Status:</strong> ${order.status || '-'}</p>
        </div>

        <h3 style="color:#8b5e4b;">Cliente</h3>
        <p><strong>Nome:</strong> ${customer.name || '-'}</p>
        <p><strong>WhatsApp:</strong> ${customer.phone || '-'}</p>
        <p><strong>E-mail:</strong> ${customer.email || '-'}</p>

        <h3 style="color:#8b5e4b;">Entrega</h3>
        <p><strong>Forma de entrega:</strong> ${customer.shipping_method || '-'}</p>
        <p><strong>CEP:</strong> ${customer.address?.zipCode || '-'}</p>
        <p><strong>Rua:</strong> ${customer.address?.street || '-'}</p>
        <p><strong>Número:</strong> ${customer.address?.number || '-'}</p>
        <p><strong>Complemento:</strong> ${customer.address?.complement || '-'}</p>
        <p><strong>Bairro:</strong> ${customer.address?.neighborhood || '-'}</p>
        <p><strong>Cidade:</strong> ${customer.address?.city || '-'}</p>
        <p><strong>Estado:</strong> ${customer.address?.state || '-'}</p>
        <p><strong>Observação de entrega:</strong> ${customer.address?.note || '-'}</p>
        <p><strong>Observação do pedido:</strong> ${customer.order_note || '-'}</p>

        <h3 style="color:#8b5e4b;">Pagamento</h3>
        <p><strong>Forma:</strong> ${customer.payment_label || customer.payment_method || '-'}</p>
        <p><strong>Subtotal:</strong> ${formatMoney(customer.subtotal || 0)}</p>
        <p><strong>Desconto:</strong> ${formatMoney(customer.discount_value || 0)}</p>
        <p><strong>Cupom:</strong> ${customer.coupon_code || '-'}</p>
        <p><strong>Taxa:</strong> ${formatMoney(customer.fee_value || 0)}</p>
        <p><strong>Total:</strong> ${formatMoney(customer.total || 0)}</p>

        <h3 style="color:#8b5e4b;">Produtos</h3>
        <ul>
          ${itemsHtml || '<li>Nenhum produto listado.</li>'}
        </ul>

        ${whatsappClientButton}

        <p>Acesse o painel da AM Closet para confirmar ou atualizar o pedido.</p>
      `
    );

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'AM Closet <onboarding@resend.dev>',
        to: getNotificationEmails(),
        subject: `Novo pedido ${orderCode} - AM Closet`,
        html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro ao enviar e-mail:', result);
    }
  } catch (error) {
    console.error('Erro no envio de e-mail:', error.message);
  }
}

/* CONFIGURAÇÕES */

app.get('/api/config', (req, res) => {
  res.json(readJson('config.json'));
});

app.put('/api/config', checkAdmin, (req, res) => {
  const config = {
    storeName: req.body.storeName || 'AM Closet',
    subtitle: req.body.subtitle || 'Looks que valorizam você!',
    whatsapp: req.body.whatsapp || '',
    instagram: req.body.instagram || '@useamcloseet'
  };

  writeJson('config.json', config);
  res.json(config);
});

app.post('/api/order-status', async (req, res) => {
  try {
    const { orderId, phone } = req.body;

    if (!orderId || !phone) {
      return res.status(400).json({
        error: 'Informe o número do pedido e o WhatsApp.'
      });
    }

    let query = supabase
      .from('orders')
      .select('*');

    if (String(orderId).toUpperCase().startsWith('AM')) {
      query = query.eq('customer->>order_code', String(orderId).toUpperCase());
    } else {
      query = query.eq('id', orderId);
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
      return res.status(404).json({
        error: 'Pedido não encontrado.'
      });
    }

    const customerPhone = String(order.customer?.phone || '').replace(/\D/g, '');
    const typedPhone = String(phone || '').replace(/\D/g, '');

    const phoneMatches =
      customerPhone === typedPhone ||
      customerPhone.endsWith(typedPhone) ||
      typedPhone.endsWith(customerPhone);

    if (!phoneMatches) {
      return res.status(403).json({
        error: 'WhatsApp não confere com este pedido.'
      });
    }

    res.json({
      ok: true,
      order
    });

  } catch (err) {
    res.status(500).json({
      error: 'Erro ao consultar pedido.',
      details: err.message
    });
  }
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
  const price = Number(req.body.price || 0);
  const promoPrice = Number(req.body.promo_price || 0);
  const isPromo = Boolean(req.body.is_promo);

const product = {
  id: String(Date.now()),
  name: req.body.name || '',
  price: price,
  promo_price: promoPrice,
  is_promo: isPromo,

  is_best_seller: Boolean(req.body.is_best_seller),
  is_featured: Boolean(req.body.is_featured),
  is_visible: req.body.is_visible !== false,
  sales_count: Number(req.body.sales_count || 0),

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
  const price = Number(req.body.price || 0);
  const promoPrice = Number(req.body.promo_price || 0);
  const isPromo = Boolean(req.body.is_promo);

const product = {
  name: req.body.name || '',
  price: price,
  promo_price: promoPrice,
  is_promo: isPromo,

  is_best_seller: Boolean(req.body.is_best_seller),
  is_featured: Boolean(req.body.is_featured),
  is_visible: req.body.is_visible !== false,
  sales_count: Number(req.body.sales_count || 0),

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

/* CUPONS */

app.get('/api/coupons', checkAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({
      error: 'Erro ao carregar cupons.',
      details: error.message
    });
  }

  res.json(data || []);
});

app.post('/api/coupons', checkAdmin, async (req, res) => {
  const coupon = {
    code: String(req.body.code || '').trim().toUpperCase(),
    discount_percent: Number(req.body.discount_percent || 0),
    discount_value: Number(req.body.discount_value || 0),
    active: Boolean(req.body.active),
    first_purchase_only: Boolean(req.body.first_purchase_only)
  };

  if (!coupon.code) {
    return res.status(400).json({
      error: 'Informe o código do cupom.'
    });
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert([coupon])
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Erro ao salvar cupom.',
      details: error.message
    });
  }

  res.json(data);
});

app.put('/api/coupons/:id', checkAdmin, async (req, res) => {
  const coupon = {
    code: String(req.body.code || '').trim().toUpperCase(),
    discount_percent: Number(req.body.discount_percent || 0),
    discount_value: Number(req.body.discount_value || 0),
    active: Boolean(req.body.active),
    first_purchase_only: Boolean(req.body.first_purchase_only)
  };

  const { data, error } = await supabase
    .from('coupons')
    .update(coupon)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Erro ao editar cupom.',
      details: error.message
    });
  }

  res.json(data);
});

app.delete('/api/coupons/:id', checkAdmin, async (req, res) => {
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: 'Erro ao excluir cupom.',
      details: error.message
    });
  }

  res.json({ ok: true });
});

app.post('/api/coupon/validate', async (req, res) => {
  try {
    const { code, items } = req.body;

    if (!code) {
      return res.status(400).json({
        valid: false,
        error: 'Informe o cupom.'
      });
    }

    if (!items || !items.length) {
      return res.status(400).json({
        valid: false,
        error: 'Carrinho vazio.'
      });
    }

    const coupon = await getCouponByCode(code);

    if (!coupon) {
      return res.status(404).json({
        valid: false,
        error: 'Cupom inválido ou inativo.'
      });
    }

    const productIds = items.map(item => String(item.id));

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      return res.status(500).json({
        valid: false,
        error: 'Erro ao validar produtos.',
        details: productsError.message
      });
    }

    const hasPromoProduct = products.some(productHasPromotion);

    if (hasPromoProduct) {
      return res.status(400).json({
        valid: false,
        error: 'Cupom não pode ser usado em produtos promocionais.'
      });
    }

    const subtotal = items.reduce((sum, item) => {
      const product = products.find(p => String(p.id) === String(item.id));
      const price = product ? getProductFinalPrice(product) : Number(item.price || 0);

      return sum + price * Number(item.quantity || 1);
    }, 0);

    const discountValue = calculateCouponDiscount(subtotal, coupon);

    res.json({
      valid: true,
      code: coupon.code,
      discount_percent: Number(coupon.discount_percent || 0),
      discount_value: discountValue,
      message: `Cupom ${coupon.code} aplicado com sucesso.`
    });

  } catch (err) {
    res.status(500).json({
      valid: false,
      error: 'Erro ao validar cupom.',
      details: err.message
    });
  }
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
    return res.status(400).json({
      error: 'Preencha nome e WhatsApp.'
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
    customer: data,
    first_purchase_coupon: 'PRIMEIRACOMPRA'
  });
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

/* CANCELAR PEDIDO */

app.put('/api/orders/:id/cancel', checkAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Informe o motivo do cancelamento.'
      });
    }

    const { data: currentOrder, error: findError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError) {
      return res.status(500).json({
        error: 'Erro ao buscar pedido.',
        details: findError.message
      });
    }

    const updatedCustomer = {
      ...(currentOrder.customer || {}),
      cancel_reason: reason,
      canceled_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'Cancelado',
        customer: updatedCustomer
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Erro ao cancelar pedido.',
        details: error.message
      });
    }

    await sendCancelOrderEmail(data, reason);

    res.json({
      ok: true,
      order: data
    });

  } catch (err) {
    res.status(500).json({
      error: 'Erro ao cancelar pedido.',
      details: err.message
    });
  }
});

/* ATUALIZAR STATUS DO PEDIDO */

app.put('/api/orders/:id/status', checkAdmin, async (req, res) => {
  try {
    const { status, tracking_code } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Informe o status.'
      });
    }

    const { data: currentOrder, error: findError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (findError) {
      return res.status(500).json({
        error: 'Erro ao buscar pedido.',
        details: findError.message
      });
    }

    const updatedCustomer = {
      ...(currentOrder.customer || {}),
      last_status_update: new Date().toISOString()
    };

    if (tracking_code) {
      updatedCustomer.tracking_code = tracking_code;
      updatedCustomer.tracking_sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        customer: updatedCustomer
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'Erro ao atualizar pedido.',
        details: error.message
      });
    }

    if (
      status === 'Confirmado' &&
      !currentOrder.customer?.payment_approved_email_sent
    ) {
      await sendPaymentApprovedEmail(data);
    }

    if (
      status === 'Confirmado' &&
      !currentOrder.customer?.stock_updated
    ) {
      const items = Array.isArray(currentOrder.items) ? currentOrder.items : [];

      for (const item of items) {
        if (!item.id) continue;

        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();

        if (!product) continue;

        const newStock = Math.max(
          Number(product.stock || 0) - Number(item.quantity || 1),
          0
        );

        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.id);
      }

      await supabase
        .from('orders')
        .update({
          customer: {
            ...(data.customer || {}),
            payment_approved_email_sent: true,
            stock_updated: true
          }
        })
        .eq('id', req.params.id);
    }

    res.json({
      ok: true,
      order: data
    });

  } catch (err) {
    res.status(500).json({
      error: 'Erro ao atualizar pedido.',
      details: err.message
    });
  }
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
      shipping_value,
      discount_value,
      coupon_code,
      total,
      status
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        error: 'Carrinho vazio.'
      });
    }

    const orderCode = generateOrderCode();

    const customerData = {
      ...(customer || {}),
      order_code: orderCode,
      payment_method: payment_method || '',
      payment_label: payment_label || '',
      subtotal: Number(subtotal || 0),
      discount_value: Number(discount_value || 0),
      coupon_code: coupon_code || '',
      fee_value: Number(fee_value || 0),
      shipping_value: Number(shipping_value || 0),
      total: Number(total || 0),
      source: 'whatsapp'
    };

    const orderItems = items.map(i => ({
      id: i.id || '',
      name: i.name || '',
      quantity: Number(i.quantity || 1),
      price: Number(i.price || 0),
      original_price: Number(i.original_price || i.price || 0),
      promo_price: Number(i.promo_price || 0),
      is_promo: Boolean(i.is_promo),
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

    await sendNewOrderEmail(order);

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
    const { items, customer, couponCode } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        error: 'Carrinho vazio.'
      });
    }

    const productIds = items.map(item => String(item.id));

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      return res.status(500).json({
        error: 'Erro ao buscar produtos.',
        details: productsError.message
      });
    }

    const orderCode = generateOrderCode();
    const method = 'credit';
    const feePercent = getPaymentFee();

    const hasPromoProduct = products.some(productHasPromotion);
    let coupon = null;

    if (couponCode && !hasPromoProduct) {
      coupon = await getCouponByCode(couponCode);
    }

    const orderItems = items.map(i => {
      const product = products.find(p => String(p.id) === String(i.id));
      const finalPrice = product ? getProductFinalPrice(product) : Number(i.price || 0);

      return {
        id: i.id || '',
        name: i.name,
        quantity: Number(i.quantity || 1),
        price: finalPrice,
        original_price: product ? Number(product.price || 0) : Number(i.price || 0),
        promo_price: product ? Number(product.promo_price || 0) : 0,
        is_promo: product ? productHasPromotion(product) : false,
        image: i.image || '',
        category: i.category || '',
        size: i.size || ''
      };
    });

    const subtotal = orderItems.reduce((total, item) => {
      return total + Number(item.price || 0) * Number(item.quantity || 1);
    }, 0);

    const discountValue = coupon
      ? calculateCouponDiscount(subtotal, coupon)
      : 0;

    const subtotalAfterDiscount = roundMoney(subtotal - discountValue);
    const feeValue = roundMoney(subtotalAfterDiscount * feePercent);
    const total = roundMoney(subtotalAfterDiscount + feeValue);

    const customerData = {
      ...(customer || {}),
      order_code: orderCode,
      payment_method: method,
      payment_label: 'Cartão de Crédito',
      subtotal,
      discount_value: discountValue,
      coupon_code: coupon?.code || '',
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

    await sendNewOrderEmail(order);

    if (
      !process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      process.env.MERCADO_PAGO_ACCESS_TOKEN.includes('COLE_')
    ) {
      return res.json({
        demo: true,
        orderId: order.id,
        subtotal,
        discountValue,
        feeValue,
        total,
        message: 'Pedido criado em modo teste. Configure Mercado Pago no Render.'
      });
    }

    const preferenceItems = orderItems.map(i => ({
      title: i.name,
      quantity: Number(i.quantity || 1),
      unit_price: roundMoney(Number(i.price || 0)),
      currency_id: 'BRL'
    }));

    if (discountValue > 0) {
      preferenceItems.push({
        title: `Desconto cupom ${coupon.code}`,
        quantity: 1,
        unit_price: -discountValue,
        currency_id: 'BRL'
      });
    }

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
      external_reference: String(orderCode),
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
      discountValue,
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

    const orderCode = paymentData.external_reference;

    if (!orderCode) {
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

    const { data: orders } = await supabase
      .from('orders')
      .select('*');

    const order = orders?.find(
      o => o.customer?.order_code === orderCode
    );

    if (order) {
      const customer = order.customer || {};
      const paymentMethod = customer.payment_method || '';

      const updatedCustomer = {
        ...customer,
        mercado_pago_status: paymentData.status,
        mercado_pago_payment_id: paymentId,
        last_payment_update: new Date().toISOString()
      };

      const isCredit =
        paymentMethod === 'credit' ||
        paymentMethod === 'credit_card' ||
        customer.payment_label === 'Cartão de Crédito';

      if (paymentData.status === 'approved' && !customer.payment_approved_email_sent) {
        updatedCustomer.payment_approved_email_sent = true;

        const updatedOrder = {
          ...order,
          status,
          customer: updatedCustomer
        };

        await sendPaymentApprovedEmail(updatedOrder);
      }

      if (
        paymentData.status === 'rejected' &&
        isCredit &&
        !customer.payment_rejected_email_sent
      ) {
        updatedCustomer.payment_rejected_email_sent = true;

        const updatedOrder = {
          ...order,
          status,
          customer: updatedCustomer
        };

        await sendPaymentRejectedCreditEmail(updatedOrder);
      }

      await supabase
        .from('orders')
        .update({
          status,
          customer: updatedCustomer
        })
        .eq('id', order.id);
    }

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

app.get('/cadastro.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'cadastro.html'));
});

app.get('/carrinho.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'carrinho.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AM Closet rodando na porta ${PORT}`);
});
