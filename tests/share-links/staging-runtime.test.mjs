import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {stagingFixture,stagingOrigin,syntheticEndpoint,stagingToken,stagingKey,stagingPublication,stagingProfile} from './staging-fixture.mjs';
let f;before(async()=>{f=await stagingFixture();});after(async()=>{await f?.stop();});
const get=(path,init)=>fetch(f.origin+path,{redirect:'manual',...init});
const path='/p/'+stagingToken;
const security=r=>{
 assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 for(const part of ["script-src 'none'","connect-src 'none'","frame-ancestors 'none'","base-uri 'none'","form-action 'none'"])assert(r.headers.get('content-security-policy').includes(part));
 for(const h of ['set-cookie','sb-error-code','access-control-expose-headers','authorization'])assert.equal(r.headers.get(h),null);
};
test('W2 HTTP workerd: POST exacto, publicación, origen fijo, HTML y headers',async()=>{
 const start=f.state.calls.length,r=await get(path+'?ignored=1',{headers:{host:'attacker.invalid',forwarded:'host=attacker.invalid','x-forwarded-host':'attacker.invalid',authorization:'visitor-fixture',cookie:'visitor=fixture','x-rlvo-preview-key':'visitor-key'}});
 assert.equal(r.status,200);security(r);const html=await r.text();
 for(const value of [stagingPublication.titulo,'$1,200 MXN','summary_large_image',stagingOrigin+path,stagingOrigin+'/og/rlvo-paleta-06.png'])assert(html.includes(value));
 for(const value of ['attacker.invalid','visitor-fixture','PRIVATE_SYNTHETIC',stagingKey,'?ignored','cloudflareinsights'])assert(!html.includes(value));
 assert(!/<script\b/i.test(html));
 const call=f.state.calls.at(-1);assert.equal(f.state.calls.length,start+1);assert.equal(call.method,'POST');assert.equal(call.path,'/functions/v1/share-preview');
 assert.deepEqual(JSON.parse(call.body),{v:1,tipo:'p',token:stagingToken});assert.equal(call.headers['x-rlvo-preview-key'],stagingKey);
 for(const h of ['authorization','cookie','apikey','forwarded','x-forwarded-host'])assert.equal(call.headers[h],undefined);
});
test('W2 HTTP workerd: perfil y HEAD mantienen disponibilidad sin cuerpo',async()=>{
 f.state.data=stagingProfile;try{
  const r=await get('/u/'+stagingToken);assert.equal(r.status,200);assert((await r.text()).includes(stagingProfile.nombre_publico));
  const h=await get('/u/'+stagingToken,{method:'HEAD'});assert.equal(h.status,200);security(h);assert.equal(await h.text(),'');
 }finally{f.state.data=stagingPublication;}
});
test('W2 HTTP workerd: 404 uniforme y sin token en errores',async()=>{
 const invalid=await get('/p/short'),body=await invalid.text();assert.equal(invalid.status,404);
 f.state.data={v:1,disponible:false};try{for(const p of [path,'/u/'+stagingToken]){const r=await get(p);assert.equal(r.status,404);assert.equal(await r.text(),body);security(r);}}
 finally{f.state.data=stagingPublication;}
 assert(!body.includes(stagingToken));
});
for(const method of ['POST','PUT','DELETE','OPTIONS'])test('W2 HTTP workerd: método '+method,async()=>{
 const n=f.state.calls.length,r=await get(path,{method});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');security(r);await r.text();assert.equal(f.state.calls.length,n);
});
for(const p of ['/p','/u','/p/short','/p/'+stagingToken+'/',path+'/extra','/p/%53'+stagingToken.slice(1),'/%70/'+stagingToken,'/p//'+stagingToken])
 test('W2 HTTP workerd: ruta inválida '+p.slice(0,8)+':'+p.length,async()=>{const n=f.state.calls.length,r=await get(p);assert.equal(r.status,404);await r.text();assert.equal(f.state.calls.length,n);});
for(const mode of [400,401,405,413,429,500,502,503,'redirect','network','large','bad-json','bad-type','truncate'])
 test('W2 HTTP workerd: fallo upstream '+mode,async()=>{
 f.state.mode=mode;try{const n=f.state.calls.length,r=await get(path);assert.equal(r.status,503);security(r);const body=await r.text();assert(!body.includes('PRIVATE_SYNTHETIC'));assert.equal(f.state.calls.length,n+1);assert.equal(f.state.denied,0);}finally{f.state.mode='normal';}
});
test('W2 HTTP workerd: datos adicionales y XSS',async()=>{
 try{
  f.state.data={...stagingPublication,correo:'synthetic@example.invalid'};const bad=await get(path);assert.equal(bad.status,503);assert(!(await bad.text()).includes('synthetic@example.invalid'));
  const xss='"><img src=x onerror=alert(1)><script>fixture</script>&';
  for(const data of [{...stagingPublication,titulo:xss},{...stagingProfile,nombre_publico:xss}]){
   f.state.data=data;const r=await get(data.tipo==='perfil'?'/u/'+stagingToken:path);assert.equal(r.status,200);const h=await r.text();assert(h.includes('&lt;script'));assert(!h.includes('content=""><img'));
  }
 }finally{f.state.data=stagingPublication;}
});
for(const mode of ['slow-headers','slow-body'])test('W2 HTTP workerd: deadline total '+mode,{timeout:20000},async()=>{
 f.state.mode=mode;try{
  const start=Date.now(),r=await get(path);assert.equal(r.status,503);await r.text();assert(Date.now()-start>=5900&&Date.now()-start<10000);
 }finally{f.state.mode='normal';}
});
test('W2 HTTP workerd: assets mínimos públicos y nada de landing/legal/plantilla',async()=>{
 const n=f.state.calls.length;
 for(const p of ['/favicon.svg','/brand/07_logo_horizontal_verde_transparente.svg','/og/rlvo-paleta-06.png','/robots.txt']){
  const r=await get(p);assert.equal(r.status,200);security(r);const b=await r.arrayBuffer();assert(b.byteLength>0);
 }
 for(const p of ['/','/index.html','/privacidad','/terminos','/legal/manifest.json','/legal/borradores/terminos.md','/sitemap-index.xml','/compartir/plantilla','/compartir/plantilla/','/compartir/plantilla.html','/compartir/%70lantilla','/compartir/plantilla%2ehtml','/compartir//plantilla','/compartir/a/../plantilla.html','/%63ompartir/plantilla','/compartir/plantilla.html?x=1']){
  const r=await get(p);assert.equal(r.status,404,p);assert.equal(r.headers.get('location'),null);security(r);await r.text();
 }
 assert.equal(f.state.calls.length,n);
});
for(const [name,overrides,status] of [
 ['apagada',{SHARE_LINKS_ENABLED:'false'},404],['ausente',{SHARE_LINKS_ENABLED:undefined},404],
 ['ambiente local',{SHARE_LINKS_ENV:'local'},503],['PROD',{SHARE_LINKS_ENV:'production'},503],['ambiente ausente',{SHARE_LINKS_ENV:undefined},503],
 ['origen ausente',{SHARE_LINKS_PUBLIC_ORIGIN:undefined},503],['origen producción',{SHARE_LINKS_PUBLIC_ORIGIN:'https://www.rlvo.com.mx'},503],
 ['sin clave',{SHARE_PREVIEW_KEY_CURRENT:''},503],['clave inválida',{SHARE_PREVIEW_KEY_CURRENT:'short'},503],
 ['endpoint distinto',{SHARE_PREVIEW_URL:'https://another-target.invalid/functions/v1/share-preview'},503],
 ['puerto explícito',{SHARE_PREVIEW_URL:syntheticEndpoint.replace('.co/','.co:443/')},503],
 ['query',{SHARE_PREVIEW_URL:syntheticEndpoint+'?x=1'},503],['fragment',{SHARE_PREVIEW_URL:syntheticEndpoint+'#x'},503]
])test('W2 HTTP workerd: '+name+' sin llamadas upstream',async()=>{
 const other=await stagingFixture(overrides);try{
  const r=await fetch(other.origin+path);assert.equal(r.status,status);security(r);const html=await r.text();
  assert.equal(other.state.calls.length,0);assert.equal(other.state.denied,0);
  if(Object.hasOwn(overrides,'SHARE_LINKS_PUBLIC_ORIGIN')&&(overrides.SHARE_LINKS_PUBLIC_ORIGIN===undefined||overrides.SHARE_LINKS_PUBLIC_ORIGIN==='https://www.rlvo.com.mx')){
   assert(!/rel="canonical"|property="og:url"|property="og:image"|https?:\/\//.test(html));
  }
 }finally{await other.stop();}
});
test('W2 HTTP workerd: entrada sellada ignora intento de pin por variable',async()=>{
 const other=await stagingFixture({SHARE_PREVIEW_ENDPOINT_SHA256:'synthetic'},{sealed:true});try{
  const r=await fetch(other.origin+path);assert.equal(r.status,503);await r.text();assert.equal(other.state.calls.length,0);assert.equal(other.state.denied,0);
 }finally{await other.stop();}
});
test('W2 HTTP workerd: HEAD de error sin cuerpo',async()=>{
 f.state.mode=503;try{const r=await get(path,{method:'HEAD'});assert.equal(r.status,503);security(r);assert.equal(await r.text(),'');}finally{f.state.mode='normal';}
});

test('W2 workerd: toda salida no esperada se rechaza sin fallback de red',async()=>{
 const {Miniflare,Response,Log,LogLevel,convertV4MiniflareOptions}=await import('miniflare');
 let intercepted=0;
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,cf:false,log:new Log(LogLevel.NONE),
 modules:true,compatibilityDate:'2026-09-29',script:"export default {async fetch(){return fetch('https://w2-unmatched.invalid/canary');}}",
 outboundService:async()=>{intercepted++;return new Response('BLOCKED_LOCAL',{status:503});}}));
 try{const r=await fetch(await mf.ready);assert.equal(r.status,503);assert.equal(await r.text(),'BLOCKED_LOCAL');assert.equal(intercepted,1);}
 finally{await mf.dispose();}
});

for(const [name,value] of [
 ['SHARE_LINKS_ENV','prod'],['SHARE_LINKS_ENV','preview'],['SHARE_LINKS_ENABLED','TRUE'],
 ['SHARE_LINKS_PUBLIC_ORIGIN',stagingOrigin+'/'],['SHARE_LINKS_PUBLIC_ORIGIN',stagingOrigin+':443'],['SHARE_LINKS_PUBLIC_ORIGIN','https://rlvo.com.mx'],
 ['SHARE_PREVIEW_KEY_CURRENT','x'.repeat(32)+'\n'],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('https:','http:')],['SHARE_PREVIEW_URL',syntheticEndpoint.replace('https://','https://user:pass@')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('.co/','.co:8443/')],['SHARE_PREVIEW_URL',syntheticEndpoint.replace('.co/','.co./')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('syntheticstaging0000','syntheticstaging0001')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('.co/','.co.evil.invalid/')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('synthetic','SYNTHETIC')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('/functions/','/x/../functions/')],
 ['SHARE_PREVIEW_URL',syntheticEndpoint.replace('share-preview','%73hare-preview')],['SHARE_PREVIEW_URL',syntheticEndpoint+'/'],
 ['SHARE_PREVIEW_URL',syntheticEndpoint+'?'],['SHARE_PREVIEW_URL',syntheticEndpoint+'#']
])test('W2 HTTP workerd: rechazo estricto sin fetch '+name+':'+value.length,async()=>{
 const other=await stagingFixture({[name]:value});try{
  const r=await fetch(other.origin+path);assert.equal(r.status,503);await r.text();assert.equal(other.state.calls.length,0);assert.equal(other.state.denied,0);
 }finally{await other.stop();}
});
