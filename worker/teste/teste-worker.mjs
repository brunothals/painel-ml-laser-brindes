import w from '../src/index.js';
const kv=new Map();const KV={async get(k,o){const v=kv.get(k);if(v==null)return null;return o&&o.type==='json'?JSON.parse(v):v;},async put(k,v){kv.set(k,v);},async delete(k){kv.delete(k);}};
const env={ML_APP_ID:'123',ML_SECRET:'sec',APP_KEY:'chave',ML_KV:KV};
let chamadas=[];let tokenN=0;
globalThis.fetch=async(u,o={})=>{const url=String(u);chamadas.push(url.replace('https://api.mercadolibre.com',''));const J=(x,s=200)=>new Response(JSON.stringify(x),{status:s});
  if(url.endsWith('/oauth/token')){const b=new URLSearchParams(o.body);tokenN++;return J({access_token:'AT'+tokenN,refresh_token:'RT'+tokenN,expires_in:21600,user_id:999,grant:b.get('grant_type')});}
  if(url.endsWith('/users/me'))return J({nickname:'CONTA_PESQUISA'});
  if(url.includes('/categories/'))return J({name:'Adesivos',path_from_root:[{name:'Casa'},{name:'Adesivos'}]});
  if(url.includes('/trends/MLB/'))return J(Array.from({length:50},(_,i)=>({keyword:'termo '+i+(i===0?' natal snoopy':''),url:'https://lista.mercadolivre.com.br/t'+i})));
  if(url.includes('/highlights/'))return J({content:[{id:'MLB1',position:1,type:'ITEM'},{id:'MLB2',position:2,type:'ITEM'},{id:'MLBP9',position:3,type:'PRODUCT'}]});
  if(url.includes('/items?ids='))return J([{code:200,body:{id:'MLB1',title:'Adesivo DTF UV Natal Snoopy',price:29.9,permalink:'https://x/1',seller_id:5,sold_quantity:500,shipping:{logistic_type:'fulfillment'}}},{code:200,body:{id:'MLB2',title:'Cartela Professores',price:24.9,permalink:'https://x/2',seller_id:6}}]);
  if(url.includes('/products/'))return J({name:'Kit adesivos',buy_box_winner:{price:39.9,seller_id:5}});
  if(url.includes('/users/'))return J({nickname:'LOJA'+url.split('/').pop()});
  if(url.includes('/domain_discovery/'))return J([{category_id:'MLB1234',category_name:'Adesivos Decorativos',domain_name:'Adesivos'}]);
  if(url.includes('/sites/MLB/search'))return url.includes('bloqueado')?J({message:'forbidden'},403):J({paging:{total:812},results:[{id:'MLB7',title:'Adesivo natal',price:19.9,permalink:'https://x/7',seller:{id:8,nickname:'CONC'},shipping:{free_shipping:true}}]});
  return J({message:'nao mockado '+url},404);};
const req=(p)=>w.fetch(new Request('https://ml.exemplo.workers.dev'+p),env);
const ok=(c,m)=>{if(!c){console.log('FALHOU:',m);process.exitCode=1;}else console.log('ok -',m);};
let r=await req('/api/status?key=errada');ok(r.status===403,'chave errada bloqueia');
r=await req('/api/status?key=chave');let j=await r.json();ok(j.conectado===false,'status sem conta');
r=await req('/api/mercado?key=chave&cats=MLB1234');j=await r.json();ok(r.status===500&&/Nenhuma conta/.test(j.erro),'coleta sem conta dá erro claro');
r=await req('/auth/start?key=chave');ok(r.status===302&&r.headers.get('location').startsWith('https://auth.mercadolivre.com.br/authorization?'),'auth/start redireciona ao ML');
const loc=new URL(r.headers.get('location'));ok(loc.searchParams.get('redirect_uri')==='https://ml.exemplo.workers.dev/auth/callback','redirect_uri correto');
r=await req('/auth/callback?code=abc&state=falso');ok(r.status===400,'state inválido recusado');
r=await req('/auth/callback?code=abc&state='+loc.searchParams.get('state'));ok(r.status===200&&(await r.text()).includes('CONTA_PESQUISA'),'callback conecta e mostra a conta');
r=await req('/api/categorias?key=chave&q=adesivo%20dtf%20uv');j=await r.json();ok(j[0].id==='MLB1234','descobre categoria');
// dia 1
r=await req('/api/mercado?key=chave&cats=MLB1234,../evil&termos=adesivo%20dtf%20uv%20natal,bloqueado');j=await r.json();
ok(j.categorias.length===1,'categoria inválida descartada');const c=j.categorias[0];
ok(c.tendencias.length===50&&c.tendencias[0].grupo==='crescendo'&&c.tendencias[10].grupo==='desejado'&&c.tendencias[30].grupo==='popular','buscas em alta agrupadas');
ok(c.mais_vendidos.length===3&&c.mais_vendidos[0].vendedor==='LOJA5'&&c.mais_vendidos[0].full===true&&c.mais_vendidos[2].titulo==='Kit adesivos','mais vendidos detalhados');
ok(j.buscas[0].itens.length===1&&/403/.test(j.buscas[1].erro),'busca por termo e erro 403 tratado');
const n1=chamadas.length;r=await req('/api/mercado?key=chave&cats=MLB1234&termos=adesivo%20dtf%20uv%20natal,bloqueado');ok(chamadas.length===n1,'segunda chamada no mesmo dia usa o cache');
// dia seguinte: histórico
const h=JSON.parse(kv.get('hist:MLB1234'));const d=Object.keys(h.datas)[0];h.datas={'2026-01-01':{MLB2:1,MLB1:5,MLBX:3}};kv.set('hist:MLB1234',JSON.stringify(h));
const ht=JSON.parse(kv.get('histbuscas:MLB1234'));ht.datas={'2026-01-01':['termo 1','termo 2']};kv.set('histbuscas:MLB1234',JSON.stringify(ht));
// força renovação de token
const t=JSON.parse(kv.get('tokens'));t.expira=Date.now()-1;kv.set('tokens',JSON.stringify(t));
r=await req('/api/mercado?key=chave&cats=MLB1234&forcar=1&download=1');j=await r.json();const c2=j.categorias[0];
ok(JSON.parse(kv.get('tokens')).access_token==='AT2'&&JSON.parse(kv.get('tokens')).refresh_token==='RT2','token renovado e guardado');
ok(c2.mais_vendidos[0].pos_anterior===5&&c2.mais_vendidos[1].pos_anterior===1&&c2.mais_vendidos[2].novo===true&&c2.sairam===1,'subiu/caiu/novo/saíram calculados');
ok(c2.tendencias[0].novo===true&&c2.tendencias[1].novo===false,'buscas novas marcadas');
ok(/attachment/.test(r.headers.get('content-disposition')),'download devolve arquivo');
ok(r.headers.get('access-control-allow-origin')==='*','CORS liberado para o painel');
// cron
await new Promise(res=>w.scheduled({}, env, {waitUntil:p=>p.then(res)}));ok(JSON.parse(kv.get('snap:ultimo')).categorias[0].id==='MLB1234','coleta diária roda com a última configuração');
console.log('tamanho do JSON:',JSON.stringify(j).length,'bytes');
