import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,Response as MockResponse,Log,LogLevel,convertV4MiniflareOptions} from 'miniflare';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {token,rev,key,cfg,previewCfg,envVars,path,none,unavailable,revision,source} from './og-fixture.mjs';

const publication={v:1,tipo:'publicacion',disponible:true,titulo:'Libro OG sintético',precio_mxn:321};
const profile={v:1,tipo:'perfil',disponible:true,nombre_publico:'Perfil sintético'};
const state={calls:[],preview:publication,og:revision,status:200,rev,corrupt:false};
const instances=[];let on,off,normal,absent;
async function fixture(ogEnabled, {normalEntry=false,overrides={}}={}) {
 const result=await build({entryPoints:[normalEntry?'worker/index.ts':'worker/og-local.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
 const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},log:new Log(LogLevel.NONE),logRequests:false,
  modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-09-29',images:{binding:'IMAGES'},
  bindings:Object.fromEntries(Object.entries({...envVars,SHARE_OG_ENABLED:ogEnabled,...overrides}).filter(([,v])=>v!==undefined)),
  assets:{directory:resolve('dist'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},assetConfig:{html_handling:'drop-trailing-slash',not_found_handling:'404-page'}},
  outboundService:async request=>{
   if(![cfg.endpoint,previewCfg.endpoint].includes(request.url))throw Error('LOCAL_EGRESS_DENIED');
   const body=await request.json();state.calls.push({url:request.url,body,headers:Object.fromEntries(request.headers)});
   if(request.url===previewCfg.endpoint)return new MockResponse(JSON.stringify(state.preview),{headers:{'content-type':'application/json'}});
   assert.equal(request.headers.get('x-rlvo-og-key'),key);assert.equal(request.headers.get('authorization'),null);
   if(body.op==='bytes' && state.og===revision && state.status===200){
    const b=state.corrupt?source.subarray(0,-6):source;
    return new MockResponse(b,{headers:{'content-type':'image/png','content-length':String(b.length),'x-rlvo-og-rev':state.rev,'x-rlvo-og-key':key,'set-cookie':'PRIVATE_COOKIE=1'}});
   }
   return new MockResponse(JSON.stringify(state.og),{status:state.status,headers:{'content-type':'application/json','x-rlvo-og-key':key}});
  }
 }));
 instances.push(mf);await mf.ready;return mf;
}
before(async()=>{on=await fixture('true');off=await fixture('false');normal=await fixture('true',{normalEntry:true});absent=await fixture(undefined);});
after(async()=>{for(const mf of instances)await mf.dispose();});
const fetchLocal=(mf,p,method='GET')=>mf.dispatchFetch(previewCfg.origin+p,{method});
const reset=()=>{state.preview=publication;state.og=revision;state.status=200;state.rev=rev;state.corrupt=false;state.calls=[];};

test('OG real workerd HTML metadata and sequential exact operations',async()=>{
 reset();const r=await fetchLocal(on,'/p/'+token);assert.equal(r.status,200);const html=await r.text();
 for(const s of ['og:image','twitter:image','summary_large_image',previewCfg.origin+path,'$321 MXN','Libro OG sintético'])assert(html.includes(s));
 assert(html.includes('rel="canonical" href="'+previewCfg.origin+'/p/'+token+'"'));
 assert(html.includes('property="og:url" content="'+previewCfg.origin+'/p/'+token+'"'));
 assert.deepEqual(state.calls.map(x=>x.body),[{v:1,tipo:'p',token},{v:1,op:'rev',token}]);
 assert(!html.includes(key));assert(!html.includes(cfg.endpoint));
});
test('OG real workerd revocation between HTML and image never returns old photo',async()=>{
 reset();assert.equal((await fetchLocal(on,'/p/'+token)).status,200);state.status=404;state.og=unavailable;
 const r=await fetchLocal(on,path);assert.equal(r.status,404);assert.equal(await r.text(),'');assert.equal(state.calls.at(-1).body.op,'bytes');
});
test('OG real workerd discards available preview on rev 404',async()=>{
 reset();state.og=unavailable;state.status=404;const r=await fetchLocal(on,'/p/'+token);assert.equal(r.status,404);const html=await r.text();assert(!html.includes(publication.titulo));assert(!html.includes('$321'));
});
test('OG real workerd rev 503 has no successful generic social metadata',async()=>{
 reset();state.og={error:'no_disponible_temporalmente'};state.status=503;const r=await fetchLocal(on,'/p/'+token);assert.equal(r.status,503);const html=await r.text();assert(!html.includes('og:image'));assert(!html.includes('twitter:image'));assert(!html.includes(publication.titulo));
});
test('OG OFF preserves publication/profile HTML and never calls OG',async()=>{
 reset();const a=await fetchLocal(off,'/p/'+token);assert.equal(a.status,200);assert((await a.text()).includes('/og/rlvo-paleta-06.png'));assert.equal(state.calls.length,1);
 assert.equal((await fetchLocal(off,path)).status,404);assert.equal(state.calls.length,1);
 state.preview=profile;
 const offProfile=await fetchLocal(off,'/u/'+token),onProfile=await fetchLocal(on,'/u/'+token);
 assert.equal(onProfile.status,200);assert.equal(await onProfile.text(),await offProfile.text());assert.equal(state.calls.filter(x=>x.url===cfg.endpoint).length,0);
});
test('normal W1 entry stays OFF even with full local config and forged headers',async()=>{
 reset();
 const headers={host:'127.0.0.1:8901','x-forwarded-host':'127.0.0.1:8901','x-forwarded-for':'127.0.0.1',
  forwarded:'for=127.0.0.1;host=127.0.0.1:8901;proto=http','x-real-ip':'127.0.0.1',
  'SHARE_OG_ENABLED':'true','SHARE_LINKS_ENV':'local','ogLocalTesting':'true','x-rlvo-og-key':key};
 const page=await normal.dispatchFetch(previewCfg.origin+'/p/'+token+'?SHARE_OG_ENABLED=true&ogLocalTesting=true',{headers});
 assert.equal(page.status,200);const html=await page.text();assert(html.includes('/og/rlvo-paleta-06.png'));assert(!html.includes('/og/'+rev));
 for(const suffix of ['', '?SHARE_OG_ENABLED=true','?ogLocalTesting=true']){
  const r=await normal.dispatchFetch(previewCfg.origin+path+suffix,{headers});assert.equal(r.status,404);await r.text();
 }
 assert.equal(state.calls.filter(c=>c.url===cfg.endpoint).length,0);
});
test('OG real workerd no-photo metadata and fallback unchanged',async()=>{
 reset();state.og=none;const r=await fetchLocal(on,'/p/'+token);assert.equal(r.status,200);assert((await r.text()).includes('/og/rlvo-paleta-06.png'));
 const png=await fetchLocal(on,path);assert.equal(png.status,200);assert.deepEqual(Buffer.from(await png.arrayBuffer()),readFileSync('public/og/rlvo-paleta-06.png'));
});
test('OG real workerd methods, raw encoding and queries do not query backend',async()=>{
 reset();for(const p of [path+'?',path+'?x=1',path+'/',path+'/extra',path.replace('/og/','/%6fg/'),path.replace(token,'%41'+token.slice(1))]){
  const r=await fetchLocal(on,p);assert.equal(r.status,404,p);await r.text();
 }
 const r=await fetchLocal(on,path,'POST');assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');assert.equal(state.calls.length,0);
});
test('OG real workerd 409, invalid source and wrong response revision',async()=>{
 reset();state.og={error:'rev_distinta'};state.status=409;assert.equal((await fetchLocal(on,path)).status,409);
 reset();state.corrupt=true;assert.equal((await fetchLocal(on,path)).status,503);
 reset();state.rev='b'.repeat(32);assert.equal((await fetchLocal(on,path)).status,503);
});
test('OG real workerd HTML security headers and HEAD preserved',async()=>{
 reset();const a=await fetchLocal(on,'/p/'+token),b=await fetchLocal(off,'/p/'+token);
 for(const h of ['cache-control','content-security-policy','x-robots-tag','referrer-policy','x-content-type-options'])assert.equal(a.headers.get(h),b.headers.get(h));
 const head=await fetchLocal(on,'/p/'+token,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('OG offline Images decoding succeeds; overlay is explicitly NOT validated',async()=>{
 reset();const r=await fetchLocal(on,path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');
 for(const h of ['x-rlvo-og-rev','x-rlvo-og-key','set-cookie'])assert.equal(r.headers.get(h),null);
 const bytes=Buffer.from(await r.arrayBuffer()),meta=await sharp(bytes).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,630);assert.equal(meta.hasAlpha,false);assert.equal(meta.exif,undefined);assert.equal(meta.xmp,undefined);
 // Same synthetic reference without badge: proves the emulator omitted .draw().
 const ref=await sharp(source).resize(1200,630,{fit:'contain',background:'#F5FAF8'}).jpeg().toBuffer();
 const pixels=await sharp(bytes).raw().toBuffer(),reference=await sharp(ref).raw().toBuffer();assert.deepEqual(pixels,reference);
 const head=await fetchLocal(on,path,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
});

// ---- PL-085 Fase 6E: compatibilidad, revocación, cabeceras y exposición (workerd, egress interceptado) ----
const fallbackPng=readFileSync('public/og/rlvo-paleta-06.png');
test('6E workerd: SHARE_OG_ENABLED ausente equivale a OFF y no consulta OG',async()=>{
 reset();const page=await fetchLocal(absent,'/p/'+token);assert.equal(page.status,200);const html=await page.text();
 assert(html.includes('/og/rlvo-paleta-06.png'));assert(!html.includes('/og/'+rev));
 const image=await fetchLocal(absent,path);assert.equal(image.status,404);await image.arrayBuffer();
 assert.deepEqual(state.calls.map(c=>c.url),[previewCfg.endpoint]);
});
test('6E workerd: cada endpoint recibe solo su clave; sin Authorization, apikey ni cookies',async()=>{
 reset();await (await fetchLocal(on,'/p/'+token)).text();await (await fetchLocal(on,path)).arrayBuffer();
 const preview=state.calls.filter(c=>c.url===previewCfg.endpoint),og=state.calls.filter(c=>c.url===cfg.endpoint);
 assert.equal(preview.length,1);assert.deepEqual(og.map(c=>c.body.op),['rev','bytes']);
 for(const c of preview){assert.equal(c.headers['x-rlvo-preview-key'],previewCfg.key);assert.equal(c.headers['x-rlvo-og-key'],undefined);}
 for(const c of og){assert.equal(c.headers['x-rlvo-og-key'],key);assert.equal(c.headers['x-rlvo-preview-key'],undefined);}
 for(const c of state.calls)for(const h of ['authorization','apikey','cookie'])assert.equal(c.headers[h],undefined,h);
});
test('6E workerd: revocación (imagen:false) entre HTML e imagen sirve la marca, nunca la foto',async()=>{
 reset();const page=await fetchLocal(on,'/p/'+token);assert.equal(page.status,200);assert((await page.text()).includes(previewCfg.origin+path));
 state.og=none;
 for(const method of ['GET','HEAD']){
  const r=await fetchLocal(on,path,method);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('content-length'),String(fallbackPng.length));
  const body=Buffer.from(await r.arrayBuffer());if(method==='GET')assert.deepEqual(body,fallbackPng);else assert.equal(body.length,0);
 }
 const again=await fetchLocal(on,'/p/'+token);const html=await again.text();assert.equal(again.status,200);
 assert(!html.includes('/og/'+rev));assert(html.includes('/og/rlvo-paleta-06.png'));assert(!html.includes('Fotografía de la publicación'));
 assert.equal(state.calls.filter(c=>c.body.op==='bytes').length,2,'GET y HEAD consultan bytes; sin caché');
});
test('6E workerd: no-store, cabeceras de seguridad, paridad HEAD/GET y cero datos privados por clase de respuesta',async()=>{
 const cases=[
  ['HTML disponible','/p/'+token,()=>{},200],
  ['HTML retirada por OG','/p/'+token,()=>{state.og=unavailable;state.status=404;},404],
  ['HTML backend 503','/p/'+token,()=>{state.og={error:'no_disponible_temporalmente'};state.status=503;},503],
  ['HTML clave rechazada','/p/'+token,()=>{state.og={error:'no_autorizado'};state.status=401;},503],
  ['imagen compuesta',path,()=>{},200],
  ['imagen marca',path,()=>{state.og=none;},200],
  ['imagen retirada',path,()=>{state.og=unavailable;state.status=404;},404],
  ['imagen obsoleta',path,()=>{state.og={error:'rev_distinta'};state.status=409;},409],
  ['imagen clave rechazada',path,()=>{state.og={error:'no_autorizado'};state.status=401;},503],
  ['imagen respuesta inesperada',path,()=>{state.og={v:1,disponible:true,imagen:true,rev,extra:'PRIVATE_FIELD'};},503],
 ];
 for(const [name,p,setup,status] of cases){
  const seen={};
  for(const method of ['GET','HEAD']){
   reset();setup();const r=await fetchLocal(on,p,method);const body=Buffer.from(await r.arrayBuffer());
   assert.equal(r.status,status,name+' '+method);
   assert.equal(r.headers.get('cache-control'),'no-store',name);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow, noarchive',name);
   assert.equal(r.headers.get('referrer-policy'),'no-referrer',name);assert.equal(r.headers.get('x-content-type-options'),'nosniff',name);
   assert(r.headers.get('content-security-policy').startsWith("default-src 'none'"),name);
   for(const h of ['set-cookie','x-rlvo-og-key','x-rlvo-og-rev','x-rlvo-preview-key','allow'])assert.equal(r.headers.get(h),null,name+' '+h);
   const text=body.toString('latin1')+JSON.stringify([...r.headers]);
   for(const secret of [key,previewCfg.key,'127.0.0.1:8902','PRIVATE_COOKIE','PRIVATE_FIELD','no_autorizado','no_disponible_temporalmente'])assert(!text.includes(secret),name+' '+secret);
   if(method==='HEAD')assert.equal(body.length,0,name);
   seen[method]={type:r.headers.get('content-type'),length:r.headers.get('content-length'),retry:r.headers.get('retry-after')};
  }
  assert.equal(seen.HEAD.type,seen.GET.type,name);assert.equal(seen.HEAD.retry,seen.GET.retry,name);
  // workerd omite Content-Length: 0 en GET vacíos y lo conserva en HEAD; con cuerpo deben coincidir.
  if(p===path&&status===200)assert.equal(seen.HEAD.length,seen.GET.length,name);
  if(p===path&&status!==200)for(const v of [seen.GET.length,seen.HEAD.length])assert([null,'0'].includes(v),name);
 }
});
