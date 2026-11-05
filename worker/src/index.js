// Serviço Mercado Livre · Laser Brindes
// Roda no Cloudflare Workers. Guarda o acesso à conta do ML (OAuth), busca uma vez por dia
// as buscas em alta e os mais vendidos das categorias escolhidas, e entrega tudo ao painel.
//
// Variáveis (Cloudflare > Workers > este serviço > Settings > Variables):
//   ML_APP_ID   ID do aplicativo criado em developers.mercadolivre.com.br   (texto)
//   ML_SECRET   Secret Key do aplicativo                                     (secreta)
//   APP_KEY     uma senha qualquer que o painel usa para falar com o serviço (secreta)
// KV: ligar um namespace com o nome de variável ML_KV.

const API = 'https://api.mercadolibre.com';
const AUTH = 'https://auth.mercadolivre.com.br/authorization';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' };

const json = (o, status = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });
const html = (body, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Serviço ML · Laser Brindes</title><body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5">${body}</body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
const hoje = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lista = (s, re) => String(s || '').split(',').map((x) => x.trim()).filter((x) => x && (!re || re.test(x))).slice(0, 12);

function chaveOk(url, env) {
  return !!env.APP_KEY && url.searchParams.get('key') === env.APP_KEY;
}
function conferirConfig(env) {
  const falta = ['ML_APP_ID', 'ML_SECRET', 'APP_KEY'].filter((k) => !env[k]);
  if (!env.ML_KV) falta.push('ML_KV (KV)');
  if (falta.length) throw new Error('Faltam configurar no Cloudflare: ' + falta.join(', '));
}

// ---------- acesso (OAuth) ----------
async function tokens(env) {
  const t = await env.ML_KV.get('tokens', { type: 'json' });
  if (!t) throw new Error('Nenhuma conta do ML conectada. Use “Conectar conta do ML” no painel.');
  if (Date.now() < t.expira - 120000) return t;
  const r = await fetch(API + '/oauth/token', {
    method: 'POST',
    headers: FORM,
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ML_APP_ID, client_secret: env.ML_SECRET, refresh_token: t.refresh_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Não consegui renovar o acesso ao ML (' + (j.message || r.status) + '). Conecte a conta de novo.');
  const novo = { ...t, access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token, expira: Date.now() + (j.expires_in || 21600) * 1000 };
  await env.ML_KV.put('tokens', JSON.stringify(novo));
  return novo;
}
async function ml(env, path) {
  const t = await tokens(env);
  const r = await fetch(API + path, { headers: { accept: 'application/json', Authorization: 'Bearer ' + t.access_token } });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error((j && (j.message || j.error)) || 'HTTP ' + r.status);
    e.status = r.status;
    throw e;
  }
  return j;
}

// ---------- coleta ----------
async function detalhar(env, conteudo) {
  const itens = conteudo.filter((x) => x.type === 'ITEM').map((x) => x.id);
  const produtos = conteudo.filter((x) => x.type !== 'ITEM');
  const det = {};
  for (let i = 0; i < itens.length; i += 20) {
    try {
      const r = await ml(env, '/items?ids=' + itens.slice(i, i + 20).join(',') + '&attributes=id,title,price,permalink,seller_id,sold_quantity,thumbnail,shipping');
      (r || []).forEach((x) => {
        if (x && x.code === 200 && x.body) {
          const b = x.body;
          det[b.id] = { titulo: b.title, preco: b.price ?? null, link: b.permalink, vendedor_id: b.seller_id, vendidos: b.sold_quantity ?? null, full: !!(b.shipping && b.shipping.logistic_type === 'fulfillment') };
        }
      });
    } catch (e) { /* segue sem os detalhes */ }
  }
  for (const p of produtos) {
    try {
      const r = await ml(env, '/products/' + p.id);
      const bb = r.buy_box_winner || {};
      det[p.id] = { titulo: r.name, preco: bb.price ?? null, link: r.permalink || 'https://www.mercadolivre.com.br/p/' + p.id, vendedor_id: bb.seller_id || null, vendidos: null };
    } catch (e) {
      det[p.id] = { titulo: p.id, erro: e.message };
    }
  }
  const vendedores = [...new Set(Object.values(det).map((d) => d.vendedor_id).filter(Boolean))];
  const nomes = {};
  for (const id of vendedores) {
    const k = 'vendedor:' + id;
    let n = await env.ML_KV.get(k);
    if (!n) {
      try { n = (await ml(env, '/users/' + id)).nickname || String(id); } catch (e) { n = String(id); }
      await env.ML_KV.put(k, n, { expirationTtl: 60 * 60 * 24 * 30 });
    }
    nomes[id] = n;
  }
  return conteudo
    .map((x) => ({ pos: x.position || null, tipo: x.type, id: x.id, ...(det[x.id] || {}), vendedor: nomes[(det[x.id] || {}).vendedor_id] || null }))
    .sort((a, b) => (a.pos || 99) - (b.pos || 99));
}

async function historico(env, c) {
  const d = hoje();
  const k = 'hist:' + c.id;
  const h = (await env.ML_KV.get(k, { type: 'json' })) || { datas: {} };
  const antes = Object.keys(h.datas).filter((x) => x < d).sort();
  const ultimo = antes.length ? antes[antes.length - 1] : null;
  c.comparado_com = ultimo;
  if (ultimo) {
    const ant = h.datas[ultimo];
    c.mais_vendidos.forEach((x) => { x.pos_anterior = ant[x.id] ?? null; x.novo = ant[x.id] == null; });
    const atuais = new Set(c.mais_vendidos.map((x) => x.id));
    c.sairam = Object.keys(ant).filter((id) => !atuais.has(id)).length;
  }
  if (c.mais_vendidos.length) {
    h.datas[d] = Object.fromEntries(c.mais_vendidos.map((x) => [x.id, x.pos]));
    h.datas = Object.fromEntries(Object.keys(h.datas).sort().slice(-45).map((x) => [x, h.datas[x]]));
    await env.ML_KV.put(k, JSON.stringify(h));
  }
  const kt = 'histbuscas:' + c.id;
  const ht = (await env.ML_KV.get(kt, { type: 'json' })) || { datas: {} };
  const antT = Object.keys(ht.datas).filter((x) => x < d).sort().pop();
  if (antT) {
    const vistos = new Set(ht.datas[antT]);
    c.tendencias.forEach((t) => { t.novo = !vistos.has(t.keyword); });
  }
  if (c.tendencias.length) {
    ht.datas[d] = c.tendencias.map((t) => t.keyword);
    ht.datas = Object.fromEntries(Object.keys(ht.datas).sort().slice(-45).map((x) => [x, ht.datas[x]]));
    await env.ML_KV.put(kt, JSON.stringify(ht));
  }
}

async function coletar(env, cats, termos) {
  const t = await tokens(env);
  const snap = { gerado: new Date().toISOString(), data: hoje(), conta: { id: t.user_id, nickname: t.nickname || null }, categorias: [], buscas: [] };
  for (const cat of cats) {
    const c = { id: cat, nome: cat, caminho: '', tendencias: [], mais_vendidos: [] };
    try {
      const info = await ml(env, '/categories/' + cat);
      c.nome = info.name || cat;
      c.caminho = (info.path_from_root || []).map((x) => x.name).join(' › ');
    } catch (e) { c.erro_categoria = e.message; }
    try {
      const tr = await ml(env, '/trends/MLB/' + cat);
      c.tendencias = (tr || []).map((x, i) => ({ pos: i + 1, keyword: x.keyword, url: x.url, grupo: i < 10 ? 'crescendo' : i < 30 ? 'desejado' : 'popular' }));
    } catch (e) { c.erro_tendencias = e.message; }
    try {
      const hl = await ml(env, '/highlights/MLB/category/' + cat);
      c.mais_vendidos = await detalhar(env, (hl && hl.content) || []);
    } catch (e) { c.erro_mais_vendidos = e.message; }
    await historico(env, c);
    snap.categorias.push(c);
  }
  for (const termo of termos) {
    const b = { termo, itens: [] };
    try {
      const s = await ml(env, '/sites/MLB/search?limit=15&q=' + encodeURIComponent(termo));
      b.total = (s.paging && s.paging.total) || null;
      b.itens = (s.results || []).map((x) => ({
        id: x.id, titulo: x.title, preco: x.price ?? null, link: x.permalink, vendidos: x.sold_quantity ?? null,
        vendedor: (x.seller && (x.seller.nickname || x.seller.id)) || null,
        full: !!(x.shipping && x.shipping.logistic_type === 'fulfillment'), frete_gratis: !!(x.shipping && x.shipping.free_shipping),
      }));
    } catch (e) {
      b.erro = e.status === 403 ? 'O Mercado Livre não liberou a busca para este aplicativo (403).' : e.message;
    }
    snap.buscas.push(b);
  }
  return snap;
}

const chaveSnap = (cats, termos) => 'snap:' + hoje() + ':' + cats.join(',') + '|' + termos.join(',').slice(0, 300);

// ---------- rotas ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const p = url.pathname;
    try {
      if (p === '/') {
        const t = env.ML_KV ? await env.ML_KV.get('tokens', { type: 'json' }) : null;
        return html(`<h1>Serviço Mercado Livre · Laser Brindes</h1><p>${t ? `Conectado à conta <b>${esc(t.nickname || t.user_id)}</b>.` : 'Nenhuma conta do ML conectada ainda.'}</p><p>Para conectar ou trocar a conta, use “Conectar conta do ML” na aba Mercado ML do painel.</p>`);
      }
      if (p === '/auth/start') {
        if (!chaveOk(url, env)) return html('<p>Chave do serviço inválida.</p>', 403);
        conferirConfig(env);
        const state = crypto.randomUUID();
        await env.ML_KV.put('state:' + state, '1', { expirationTtl: 600 });
        const a = new URL(AUTH);
        a.search = new URLSearchParams({ response_type: 'code', client_id: env.ML_APP_ID, redirect_uri: url.origin + '/auth/callback', state }).toString();
        return Response.redirect(a.toString(), 302);
      }
      if (p === '/auth/callback') {
        conferirConfig(env);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state || !(await env.ML_KV.get('state:' + state))) {
          return html('<p>Link de conexão inválido ou expirado. Volte ao painel e clique em “Conectar conta do ML” de novo.</p>', 400);
        }
        await env.ML_KV.delete('state:' + state);
        const r = await fetch(API + '/oauth/token', {
          method: 'POST',
          headers: FORM,
          body: new URLSearchParams({ grant_type: 'authorization_code', client_id: env.ML_APP_ID, client_secret: env.ML_SECRET, code, redirect_uri: url.origin + '/auth/callback' }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.access_token) return html(`<p>O Mercado Livre recusou a conexão: ${esc(j.message || r.status)}</p>`, 400);
        let nickname = null;
        try {
          const me = await fetch(API + '/users/me', { headers: { Authorization: 'Bearer ' + j.access_token } });
          nickname = (await me.json()).nickname || null;
        } catch (e) { /* sem apelido */ }
        await env.ML_KV.put('tokens', JSON.stringify({
          access_token: j.access_token, refresh_token: j.refresh_token, user_id: j.user_id, nickname,
          expira: Date.now() + (j.expires_in || 21600) * 1000, conectado_em: new Date().toISOString(),
        }));
        return html(`<h1>Conectado</h1><p>Conta do Mercado Livre: <b>${esc(nickname || j.user_id)}</b>.</p><p>Pode fechar esta aba e clicar em “Atualizar do ML” no painel.</p>`);
      }
      if (!p.startsWith('/api/')) return json({ erro: 'Endereço não encontrado.' }, 404);
      if (!chaveOk(url, env)) return json({ erro: 'Chave do serviço inválida.' }, 403);
      conferirConfig(env);

      if (p === '/api/status') {
        const t = await env.ML_KV.get('tokens', { type: 'json' });
        const ult = await env.ML_KV.get('snap:ultimo', { type: 'json' });
        return json({ ok: true, conectado: !!t, conta: t ? { id: t.user_id, nickname: t.nickname } : null, ultima_coleta: ult ? ult.gerado : null });
      }
      if (p === '/api/categorias') {
        const q = (url.searchParams.get('q') || '').trim();
        if (!q) return json([]);
        const r = await ml(env, '/sites/MLB/domain_discovery/search?limit=8&q=' + encodeURIComponent(q));
        return json((r || []).map((x) => ({ id: x.category_id, nome: x.category_name, dominio: x.domain_name })));
      }
      if (p === '/api/mercado') {
        const cats = lista(url.searchParams.get('cats'), /^MLB\d+$/).slice(0, 8);
        const termos = lista(url.searchParams.get('termos')).map((x) => x.slice(0, 60));
        await env.ML_KV.put('cfg', JSON.stringify({ cats, termos }));
        const ck = chaveSnap(cats, termos);
        let snap = url.searchParams.get('forcar') ? null : await env.ML_KV.get(ck, { type: 'json' });
        if (!snap) {
          snap = await coletar(env, cats, termos);
          await env.ML_KV.put(ck, JSON.stringify(snap), { expirationTtl: 60 * 60 * 26 });
          await env.ML_KV.put('snap:ultimo', JSON.stringify(snap));
        }
        const extra = url.searchParams.get('download') ? { 'Content-Disposition': `attachment; filename="mercado-ml-${hoje()}.json"` } : {};
        return json(snap, 200, extra);
      }
      return json({ erro: 'Endereço não encontrado.' }, 404);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      return p.startsWith('/api/') ? json({ erro: msg }, 500) : html('<p>Erro: ' + esc(msg) + '</p>', 500);
    }
  },

  // Uma vez por dia (horário em wrangler.toml): repete a última busca feita pelo painel,
  // para o histórico de “subiu / caiu” existir mesmo se ninguém abrir o painel.
  async scheduled(evento, env, ctx) {
    ctx.waitUntil((async () => {
      if (!env.ML_KV || !env.ML_APP_ID || !env.ML_SECRET) return;
      const cfg = await env.ML_KV.get('cfg', { type: 'json' });
      if (!cfg || !(await env.ML_KV.get('tokens'))) return;
      const snap = await coletar(env, cfg.cats || [], cfg.termos || []);
      await env.ML_KV.put('snap:ultimo', JSON.stringify(snap));
      await env.ML_KV.put(chaveSnap(cfg.cats || [], cfg.termos || []), JSON.stringify(snap), { expirationTtl: 60 * 60 * 26 });
    })());
  },
};
