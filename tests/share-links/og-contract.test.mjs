// PL-085 Fase 6E — compatibilidad del Worker con el contrato HTTP de `share-og-source`.
// Respuestas sintéticas con la forma de cable que emite la Edge Function (JSON con charset,
// cabeceras de seguridad propias, Retry-After, Allow, X-RLVO-Og-Rev). Sin red, sin Supabase,
// sin Cloudflare Images y sin fotografías: la fuente es un PNG generado en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {modules,token,rev,key,cfg,request,source,codec} from './og-fixture.mjs';

const m=await modules();
const fallback=readFileSync('public/og/rlvo-paleta-06.png');

// Cabeceras que la Edge Function añade a TODAS sus respuestas. Ninguna debe llegar al público.
const EF_HEADERS={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
 'x-robots-tag':'noindex, nofollow, noarchive','content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
const efJson=(status,body,extra={})=>new Response(body,{status,headers:{'content-type':'application/json; charset=utf-8',...EF_HEADERS,...extra}});
const NO_DISPONIBLE='{"v":1,"disponible":false}';
const SIN_IMAGEN='{"v":1,"disponible":true,"imagen":false}';
const efRev=(r=rev)=>efJson(200,JSON.stringify({v:1,disponible:true,imagen:true,rev:r}));
const efError=(status,code,extra)=>efJson(status,JSON.stringify({error:code}),extra);
const efBytes=(bytes=source,mime='image/png',r=rev)=>new Response(bytes,{status:200,headers:{
 'content-type':mime,'content-length':String(bytes.length),'x-rlvo-og-rev':r,...EF_HEADERS}});
// Todas las respuestas técnicas que la Edge Function puede emitir hacia el Worker.
const EF_TECHNICAL=[
 ['503 temporal',()=>efError(503,'no_disponible_temporalmente',{'retry-after':'5'})],
 ['401 clave',()=>efError(401,'no_autorizado')],
 ['400 solicitud',()=>efError(400,'solicitud_invalida')],
 ['405 método',()=>efError(405,'metodo_no_permitido',{allow:'POST'})],
 ['413 cuerpo',()=>efError(413,'cuerpo_excesivo')],
];
const rev2=createHash('sha256').update('fase-6e-revision-sintetica').digest('hex').slice(0,32);
const PUBLIC_HEADERS=['cache-control','content-length','content-security-policy','content-type','referrer-policy','x-content-type-options','x-robots-tag'];

async function handlerWith(upstream,{images=codec()}={}){
 const old=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init.body),headers:init.headers});return upstream(calls.length);};
 const env={IMAGES:images,ASSETS:{fetch:async()=>new Response(fallback,{headers:{'content-type':'image/png'}})}};
 const handler=m.createOgHandler();
 return {calls,env,restore:()=>{globalThis.fetch=old;},
  async get(method='GET'){return handler(request(method),env,cfg);}};
}
function assertPublicOnly(response){
 const names=[...response.headers.keys()].sort();
 for(const name of names)assert(PUBLIC_HEADERS.includes(name)||name==='retry-after'||name==='allow',`cabecera inesperada: ${name}`);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.notEqual(response.headers.get('content-security-policy'),EF_HEADERS['content-security-policy']);
 for(const [,value] of response.headers)for(const secret of [key,cfg.endpoint,'127.0.0.1','supabase'])assert(!value.includes(secret));
}

test('6E contrato: revisión 200 con charset y forma exacta de la Edge Function',async()=>{
 assert.deepEqual(await m.loadOgRev(cfg,token,async()=>efRev(),100),{kind:'revision',rev});
 assert.deepEqual(await m.loadOgRev(cfg,token,async()=>efRev(rev2),100),{kind:'revision',rev:rev2});
});
test('6E contrato: sin imagen elegible, revocada o no autorizada llega como imagen:false',async()=>{
 for(const load of [m.loadOgRev,(c,t,u,ms)=>m.loadOgBytes(c,t,rev,u,ms)])
  assert.equal((await load(cfg,token,async()=>efJson(200,SIN_IMAGEN),100)).kind,'none');
});
test('6E contrato: publicación indisponible exacta en ambas operaciones',async()=>{
 for(const load of [m.loadOgRev,(c,t,u,ms)=>m.loadOgBytes(c,t,rev,u,ms)])
  assert.equal((await load(cfg,token,async()=>efJson(404,NO_DISPONIBLE),100)).kind,'unavailable');
});
test('6E contrato: 409 rev_distinta solo es conflicto en bytes',async()=>{
 assert.equal((await m.loadOgBytes(cfg,token,rev,async()=>efError(409,'rev_distinta'),100)).kind,'conflict');
 assert.equal((await m.loadOgRev(cfg,token,async()=>efError(409,'rev_distinta'),100)).kind,'temporary');
});
for(const [name,make] of EF_TECHNICAL)test('6E contrato: error técnico '+name+' es temporal en rev y bytes',async()=>{
 assert.equal((await m.loadOgRev(cfg,token,async()=>make(),100)).kind,'temporary');
 assert.equal((await m.loadOgBytes(cfg,token,rev,async()=>make(),100)).kind,'temporary');
});
test('6E contrato: esquema cerrado; causas, ids o rutas añadidas por el backend no se aceptan',async()=>{
 for(const [status,body] of [
  [200,'{"v":1,"disponible":true,"imagen":false,"causa":"causa_sintetica"}'],
  [200,JSON.stringify({v:1,disponible:true,imagen:true,rev,ruta:'sintetica/ruta.jpg'})],
  [200,JSON.stringify({v:1,disponible:true,imagen:true,rev,sha256:'0'.repeat(64)})],
  [200,NO_DISPONIBLE],[404,SIN_IMAGEN],[200,'{"v":1,"disponible":true,"imagen":true}'],
  [200,JSON.stringify({v:1,disponible:true,imagen:true,rev:rev.toUpperCase()})],
  [200,JSON.stringify({v:2,disponible:true,imagen:false})],[503,SIN_IMAGEN],[503,NO_DISPONIBLE],
 ]){
  assert.equal((await m.loadOgRev(cfg,token,async()=>efJson(status,body),100)).kind,'temporary',status+' '+body);
 }
});
test('6E contrato: variantes de Content-Type JSON',async()=>{
 for(const type of ['application/json','application/json; charset=utf-8','application/json;charset=UTF-8'])
  assert.equal((await m.loadOgRev(cfg,token,async()=>new Response(SIN_IMAGEN,{headers:{'content-type':type}}),100)).kind,'none',type);
 for(const type of ['text/json','application/problem+json','application/json; charset=latin1','text/html','',undefined])
  assert.equal((await m.loadOgRev(cfg,token,async()=>new Response(SIN_IMAGEN,{headers:type===undefined?{}:{'content-type':type}}),100)).kind,'temporary',String(type));
});
test('6E contrato: bytes con cabeceras de la Edge Function para JPEG, PNG y WebP',async()=>{
 for(const [mime,format] of [['image/jpeg','jpeg'],['image/png','png'],['image/webp','webp']]){
  const bytes=await sharp(source)[format]().toBuffer();
  const result=await m.loadOgBytes(cfg,token,rev,async()=>efBytes(bytes,mime),100);
  assert.equal(result.kind,'image',mime);assert.equal(result.mime,mime);
 }
});
test('6E contrato: cota de fuente idéntica a la del backend (5 242 880 B)',()=>{
 assert.equal(m.MAX_IMAGE_BYTES,5_242_880);
 assert.equal(m.OG_IMAGE_TIMEOUT_MS,15_000);
});

test('6E público: imagen autorizada solo expone cabeceras propias del Worker',async()=>{
 const h=await handlerWith(()=>efBytes());
 try{
  for(const method of ['GET','HEAD']){
   const r=await h.get(method);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');assertPublicOnly(r);
   assert.equal(r.headers.get('x-rlvo-og-rev'),null);assert.equal(r.headers.get('retry-after'),null);
   const body=Buffer.from(await r.arrayBuffer());
   if(method==='HEAD')assert.equal(body.length,0);else assert(!body.includes(Buffer.from(key)));
   assert(Number(r.headers.get('content-length'))>0);
  }
  assert.deepEqual(h.calls.map(c=>c.body),[{v:1,op:'bytes',token,rev},{v:1,op:'bytes',token,rev}]);
 }finally{h.restore();}
});
for(const [name,make] of EF_TECHNICAL)test('6E público: '+name+' del backend → 503 vacío, Retry-After 5, sin Allow ni cuerpo privado',async()=>{
 const h=await handlerWith(make);
 try{
  for(const method of ['GET','HEAD']){
   const r=await h.get(method);assert.equal(r.status,503);assertPublicOnly(r);
   assert.equal(r.headers.get('retry-after'),'5');assert.equal(r.headers.get('allow'),null);
   assert.equal(r.headers.get('content-type'),null);assert.equal(r.headers.get('content-length'),'0');
   assert.equal((await r.arrayBuffer()).byteLength,0);
  }
 }finally{h.restore();}
});
test('6E público: imagen:false entrega el PNG de marca byte a byte en GET y HEAD',async()=>{
 const h=await handlerWith(()=>efJson(200,SIN_IMAGEN));
 try{
  const get=await h.get();assert.equal(get.status,200);assert.equal(get.headers.get('content-type'),'image/png');assertPublicOnly(get);
  assert.deepEqual(Buffer.from(await get.arrayBuffer()),fallback);
  const head=await h.get('HEAD');assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(fallback.length));
  assert.equal((await head.arrayBuffer()).byteLength,0);
 }finally{h.restore();}
});
test('6E público: 404 y 409 vacíos, sin Retry-After, en GET y HEAD',async()=>{
 for(const [make,status] of [[()=>efJson(404,NO_DISPONIBLE),404],[()=>efError(409,'rev_distinta'),409]]){
  const h=await handlerWith(make);
  try{for(const method of ['GET','HEAD']){
   const r=await h.get(method);assert.equal(r.status,status);assertPublicOnly(r);assert.equal(r.headers.get('retry-after'),null);
   assert.equal((await r.arrayBuffer()).byteLength,0);
  }}finally{h.restore();}
 }
});
test('6E revocación: ciclo autorizar → revocar → reautorizar → nueva foto → retirar, sin caché',async()=>{
 // Una URL revisionada ya difundida se reevalúa en cada petición: el backend decide en cada op:bytes.
 const steps=[
  [()=>efBytes(),200,'image/jpeg'],          // autorizada
  [()=>efJson(200,SIN_IMAGEN),200,'image/png'], // revocada: marca, nunca la foto
  [()=>efJson(200,SIN_IMAGEN),200,'image/png'],
  [()=>efBytes(),200,'image/jpeg'],          // reautorizada: misma identidad, misma revisión
  [()=>efError(409,'rev_distinta'),409,null], // nueva portada: la URL anterior queda obsoleta
  [()=>efJson(404,NO_DISPONIBLE),404,null],   // publicación retirada
 ];
 let current=0;const h=await handlerWith(()=>steps[current][0]());
 try{
  for(;current<steps.length;current++){
   const [,status,type]=steps[current];
   for(const method of ['GET','HEAD']){
    const r=await h.get(method);assert.equal(r.status,status,`paso ${current} ${method}`);
    assert.equal(r.headers.get('content-type'),type);assertPublicOnly(r);
    const body=Buffer.from(await r.arrayBuffer());
    if(type==='image/png'&&method==='GET')assert.deepEqual(body,fallback);
    if(type==='image/jpeg'&&method==='GET')assert.equal((await sharp(body).metadata()).format,'jpeg');
    if(method==='HEAD'||type===null)assert.equal(body.length,0);
   }
  }
  assert.equal(h.calls.length,steps.length*2,'una consulta op:bytes por petición; sin caché interna');
 }finally{h.restore();}
});
test('6E revocación: el HTML deja de publicar la ruta revisionada cuando rev devuelve imagen:false',async()=>{
 assert.equal((await m.loadOgRev(cfg,token,async()=>efRev(),100)).kind,'revision');
 assert.equal((await m.loadOgRev(cfg,token,async()=>efJson(200,SIN_IMAGEN),100)).kind,'none');
});
test('6E integridad: distintivo embebido corresponde al SVG oficial y decodifica a 240×90',async()=>{
 const svg=readFileSync('public/brand/11_logo_horizontal_menta_sobre_verde.svg');
 const code=readFileSync('worker/og-badge.ts','utf8');
 assert(code.includes('// Source SHA-256: '+createHash('sha256').update(svg).digest('hex')));
 const base64=/badgeBase64 = '([A-Za-z0-9+/=]+)'/.exec(code)?.[1];assert(base64);
 const meta=await sharp(Buffer.from(base64,'base64')).metadata();
 assert.equal(meta.format,'png');assert.equal(meta.width,240);assert.equal(meta.height,90);
});
