import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,token,key,publication,profile} from './fixture.mjs';
let f;
before(async()=>{f=await fixture();});
after(async()=>{await f?.stop();});
const get=(path,init)=>fetch(f.origin+path,{redirect:'manual',...init});
const checkHeaders=r=>{
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert(r.headers.get('content-security-policy').includes("script-src 'none'"));
 for(const h of ['set-cookie','sb-error-code','access-control-expose-headers','authorization'])assert.equal(r.headers.get(h),null);
};
test('HTTP real: publicación, contrato exacto, metadatos iniciales y headers privados descartados',async()=>{
 const start=f.state.calls.length;
 const r=await get('/p/'+token+'?ignored=yes',{headers:{authorization:'visitor-secret',cookie:'visitor=secret','x-rlvo-preview-key':'visitor-key','x-forwarded-host':'evil.invalid'}});
 assert.equal(r.status,200);checkHeaders(r);const html=await r.text();
 for(const text of ['og:title','og:description','og:image','og:url','og:type','summary_large_image','$1,200 MXN','Libro de cálculo'])assert(html.includes(text));
 assert(html.includes('content="'+f.origin+'/p/'+token+'"'));assert(!html.includes('?ignored'));
 assert(html.includes(f.origin+'/og/rlvo-paleta-06.png'));
 assert(!/<script\b/i.test(html));for(const v of [key,'visitor-secret','visitor=secret','INTERNAL_FIXTURE','evil.invalid'])assert(!html.includes(v));
 const call=f.state.calls.at(-1);assert.equal(f.state.calls.length,start+1);
 assert.equal(call.method,'POST');assert.equal(call.path,'/functions/v1/share-preview');
 assert.deepEqual(JSON.parse(call.body),{v:1,tipo:'p',token});
 assert.equal(call.headers['x-rlvo-preview-key'],key);
 for(const h of ['cookie','authorization','apikey','x-forwarded-host'])assert.equal(call.headers[h],undefined);
});
test('HTTP real: perfil',async()=>{
 f.state.data=profile;const r=await get('/u/'+token);assert.equal(r.status,200);const html=await r.text();assert(html.includes('Ana L.'));assert(!html.includes('$1,200'));f.state.data=publication;
});
test('HTTP real: HEAD conserva status y headers relevantes sin cuerpo',async()=>{
 const a=await get('/p/'+token);const b=await get('/p/'+token,{method:'HEAD'});assert.equal(b.status,a.status);
 for(const h of ['content-type','cache-control','content-security-policy','x-robots-tag','referrer-policy','x-content-type-options'])assert.equal(b.headers.get(h),a.headers.get(h));
 assert.equal(await b.text(),'');await a.text();
});
test('HTTP real: 404 uniforme para inválido, inexistente y tipo contrario',async()=>{
 const bad=await get('/p/short');const body=await bad.text();assert.equal(bad.status,404);
 f.state.data={v:1,disponible:false};for(const path of ['/p/'+token,'/u/'+token]){
  const r=await get(path);assert.equal(r.status,404);assert.equal(await r.text(),body);checkHeaders(r);
 }
 const h=await get('/p/short',{method:'HEAD'});assert.equal(h.status,404);assert.equal(await h.text(),'');
 f.state.data=publication;
});
for(const path of ['/p','/u','/p/','/p/'+token+'/', '/p/'+token+'/extra','/p/%41'+token.slice(1),
 '/p/'+token+'%2Fextra','/p//'+token,'/p/'+'A'.repeat(21),'/%70/'+token]){
 test('HTTP real: ruta inválida no consulta upstream '+path.slice(0,10)+':'+path.length,async()=>{
  const before=f.state.calls.length;const r=await get(path);assert.equal(r.status,404);await r.text();assert.equal(f.state.calls.length,before);
 });
}
for(const method of ['POST','PUT','DELETE','OPTIONS'])test('HTTP real: método '+method,async()=>{
 const before=f.state.calls.length;const r=await get('/p/'+token,{method});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');checkHeaders(r);await r.text();assert.equal(f.state.calls.length,before);
});
for(const mode of [400,401,405,413,500,502,503,'redirect','network','bad-json','bad-type','large','truncate'])
 test('HTTP real: upstream '+mode+' produce 503 genérico',async()=>{
  f.state.mode=mode;const before=f.state.calls.length;const r=await get('/p/'+token);assert.equal(r.status,503);checkHeaders(r);
  const html=await r.text();assert(!html.includes('private-fixture'));assert(!html.includes('INTERNAL'));assert.equal(f.state.calls.length,before+1);f.state.mode='normal';
 });
test('HTTP real: respuesta con datos adicionales falla cerrada',async()=>{
 f.state.data={...publication,correo:'fixture@example.invalid'};const r=await get('/p/'+token);assert.equal(r.status,503);assert(!(await r.text()).includes('fixture@example.invalid'));f.state.data=publication;
});
for(const mode of ['slow-headers','slow-body'])test('HTTP real: seis segundos incluyendo '+mode,{timeout:12000},async()=>{
 f.state.mode=mode;const closed=f.state.closed;const start=Date.now();const r=await get('/p/'+token);assert.equal(r.status,503);await r.text();
 const ms=Date.now()-start;assert(ms>=5900&&ms<9500,'deadline real');await new Promise(r=>setTimeout(r,100));assert(f.state.closed>closed,'conexión upstream cancelada');f.state.mode='normal';
});
test('HTTP real: HTMLRewriter escapa texto y atributos',async()=>{
 const attack='"><img src=x onerror=alert(1)><script>alert(1)</script>&';
 f.state.data={...publication,titulo:attack};const r=await get('/p/'+token);assert.equal(r.status,200);
 const html=await r.text();assert(html.includes('&lt;script'));assert(html.includes('&lt;img'));assert(!html.includes('content=""><img'));
 f.state.data={...profile,nombre_publico:attack};const u=await get('/u/'+token);assert.equal(u.status,200);assert((await u.text()).includes('&lt;script'));f.state.data=publication;
});
test('HTTP real: regresión de assets, landing, legales, robots, sitemap, manifest y 404',async()=>{
 const before=f.state.calls.length;
 for(const path of ['/','/privacidad','/terminos','/eliminar-cuenta','/contacto','/soporte','/robots.txt','/sitemap-index.xml','/legal/manifest.json','/legal/borradores/terminos.md','/og/rlvo-paleta-06.png']){
  const r=await get(path);assert.equal(r.status,200,path);await r.arrayBuffer();
 }
 const missing=await get('/ruta-inexistente-w1');assert.equal(missing.status,404);await missing.text();assert.equal(f.state.calls.length,before);
 const download=await get('/legal/borradores/terminos.md');assert.deepEqual(Buffer.from(await download.arrayBuffer()),readFileSync('src/content/legal/drafts/terminos.md'));
});
for(const [name,overrides,status] of [
 ['apagada',{SHARE_LINKS_ENABLED:'false'},404],['sin clave',{SHARE_PREVIEW_KEY_CURRENT:''},503],
 ['sin endpoint',{SHARE_PREVIEW_URL:''},503],['endpoint externo',{SHARE_PREVIEW_URL:'https://example.invalid/functions/v1/share-preview'},503],
 ['ambiente producción',{SHARE_LINKS_ENV:'production'},503],['origen inválido',{SHARE_LINKS_PUBLIC_ORIGIN:'https://evil.invalid'},503]
])test('HTTP real: '+name+' = cero conexiones',async()=>{
 const other=await fixture(overrides);try{
  const r=await fetch(other.origin+'/p/'+token);assert.equal(r.status,status);await r.text();assert.equal(other.state.calls.length,0);
 }finally{await other.stop();}
});

test('HTTP real: Host manipulado no controla canonical ni og:url',async()=>{
 const r=await get('/p/'+token,{headers:{host:'evil.invalid','forwarded':'host=evil.invalid;proto=https'}});
 assert.equal(r.status,200);const html=await r.text();
 assert(html.includes('content="'+f.origin+'/p/'+token+'"'));assert(!html.includes('evil.invalid'));
});
test('HTTP real: HEAD 503 conserva headers del error GET sin cuerpo',async()=>{
 f.state.mode=503;try{
  const a=await get('/p/'+token);const b=await get('/p/'+token,{method:'HEAD'});
  assert.equal(b.status,503);checkHeaders(b);assert.equal(await b.text(),'');
  assert.equal(b.headers.get('content-security-policy'),a.headers.get('content-security-policy'));await a.text();
 }finally{f.state.mode='normal';}
});
test('build público no contiene configuración del Worker ni credenciales ficticias',async()=>{
 const {readdirSync}=await import('node:fs');
 for(const path of readdirSync('dist',{recursive:true}).filter(p=>/\.(?:html|js|css)$/.test(p))){
  const text=readFileSync('dist/'+path,'utf8');
  for(const forbidden of [key,'SHARE_PREVIEW_KEY_CURRENT','visitor-secret'])assert(!text.includes(forbidden),path);
 }
});
