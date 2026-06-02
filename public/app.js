let products = [], cart = [];
const money = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function load(){ products = await (await fetch('/api/products')).json(); renderProducts(); renderCart(); }
function renderProducts(){ document.getElementById('products').innerHTML = products.map(p=>`<article class="card"><img src="${p.image}" alt="${p.name}"><h3>${p.name}</h3><p>${p.description||''}</p><b>${money(p.price)}</b><small>Estoque: ${p.stock}</small><button onclick="add('${p.id}')">Adicionar</button></article>`).join(''); }
function add(id){ const p=products.find(x=>x.id===id); const item=cart.find(x=>x.id===id); if(item) item.quantity++; else cart.push({...p, quantity:1}); renderCart(); }
function removeItem(id){ cart = cart.filter(i=>i.id!==id); renderCart(); }
function renderCart(){ const total=cart.reduce((s,i)=>s+i.price*i.quantity,0); document.getElementById('cartItems').innerHTML = cart.map(i=>`<div class="cartline"><span>${i.quantity}x ${i.name}</span><button onclick="removeItem('${i.id}')">x</button></div>`).join('') || '<p>Carrinho vazio.</p>'; document.getElementById('total').textContent='Total: '+money(total); }
async function checkout(){ const msg=document.getElementById('msg'); msg.textContent='Criando pedido...'; const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart,customer:{name:document.getElementById('name').value,email:document.getElementById('email').value}})}); const data=await r.json(); if(data.init_point) location.href=data.init_point; else msg.textContent=data.message || data.error || 'Erro ao finalizar.'; }
load();
