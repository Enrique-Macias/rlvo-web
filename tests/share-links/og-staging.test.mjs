import test,{before,after} from 'node:test';
import {Miniflare,Response as MockResponse,Log,LogLevel,convertV4MiniflareOptions} from 'miniflare';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {key,token,rev,source,none,unavailable,revision,binary} from './og-fixture.mjs';

const root=process.env.OG_STAGING_MODULE_ROOT??process.cwd();
const built=await build({stdin:{contents:`export * from ${JSON.stringify(resolve(root,'worker/og-staging.ts'))}; export * from ${JSON.stringify(resolve(root,'worker/og-staging-policy.ts'))}; export * from ${JSON.stringify(resolve(root,'worker/staging-policy.ts'))}; export * from ${JSON.stringify(resolve(root,'worker/staging.ts'))};`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
const m=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const start=Date.parse('2026-11-18T00:00:00.000Z'),end=start+3600000;
// Fictitious project: never a real ref. Its V1 pin is injected as a module argument, like V1 tests.
const PROJECT='abcdefghij0123456789',OTHER='zyxwvutsrq9876543210',EP=m.ogStagingEndpoints(PROJECT),OTHER_EP=m.ogStagingEndpoints(OTHER);
const PIN=createHash('sha256').update(EP.preview).digest('hex');
const manifest={v:1,projectRef:PROJECT,tokens:[token],startsAt:new Date(start).toISOString(),expiresAt:new Date(end).toISOString()};
let runtime;
const entry=await build({stdin:{contents:`import {createOgStagingWorker} from './worker/og-staging.ts'; import {createStagingWorker} from './worker/staging.ts'; import {createStagingPolicy} from './worker/staging-policy.ts'; const PIN=${JSON.stringify(PIN)}; export default {fetch(request,env){const fixtures=JSON.parse(request.headers.get('x-test-fixtures')); const now=Number(request.headers.get('x-test-now')); const pin=request.headers.get('x-test-pin')??PIN; const worker=request.headers.has('x-test-normal')?createStagingWorker(createStagingPolicy(pin)):request.headers.has('x-test-default')?createOgStagingWorker():fixtures===null?createOgStagingWorker(undefined,()=>now,pin):createOgStagingWorker(fixtures,()=>now,pin); const vars=JSON.parse(request.headers.get('x-test-vars')); return worker.fetch(request,{...env,...vars});}}`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
before(async()=>{runtime=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},log:new Log(LogLevel.NONE),logRequests:false,modules:true,script:entry.outputFiles[0].text,compatibilityDate:'2026-09-29',images:{binding:'IMAGES'},assets:{directory:resolve('dist'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},assetConfig:{html_handling:'drop-trailing-slash',not_found_handling:'404-page'}},outboundService:async request=>{const r=await globalThis.fetch(request.url,{method:request.method,redirect:request.redirect,headers:request.headers,body:await request.text()});return new MockResponse(await r.arrayBuffer(),{status:r.status,headers:r.headers});}}));await runtime.ready;});
after(async()=>{await runtime?.dispose();});
const fixture=(data=manifest,clock=()=>start+1000,normal=false,extra={})=>({fetch:async(request,e)=>{const h=new Headers(request.headers);for(const [k,v] of Object.entries(extra))h.set(k,v);h.set('x-test-fixtures',JSON.stringify(data??null));h.set('x-test-now',String(clock()));h.set('x-test-vars',JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k])=>k.startsWith('SHARE_')))));if(normal)h.set('x-test-normal','true');return runtime.dispatchFetch(request.url,{method:request.method,headers:h});}});
const env={SHARE_LINKS_ENABLED:'true',SHARE_LINKS_ENV:'staging',SHARE_LINKS_PUBLIC_ORIGIN:m.STAGING_ORIGIN,SHARE_PREVIEW_URL:EP.preview,SHARE_PREVIEW_KEY_CURRENT:'preview-'.repeat(8),SHARE_OG_ENABLED:'true',SHARE_OG_SOURCE_URL:EP.source,SHARE_OG_KEY_CURRENT:key};
const page='/p/'+token,image=page+'/og/'+rev,req=(path=page,options={})=>new Request(m.STAGING_ORIGIN+path,options);
let calls=[],attempts=[],og=revision,ogStatus=200,profile=false;
const original=globalThis.fetch;
async function mocked(fn){calls=[];attempts=[];og=revision;ogStatus=200;profile=false;globalThis.fetch=async(url,init)=>{
 attempts.push(String(url));assert([EP.preview,EP.source].includes(String(url)),'UNEXPECTED_EGRESS');
 const headers=new Headers(init.headers);assert.equal(headers.get('authorization'),null);assert.equal(headers.get('apikey'),null);
 const body=JSON.parse(init.body);calls.push({url,body});
 if(url===EP.preview)return Response.json(profile?{v:1,tipo:'perfil',disponible:true,nombre_publico:'Perfil sintético'}:{v:1,tipo:'publicacion',disponible:true,titulo:'Fixture sintético',precio_mxn:10});
 assert.equal(headers.get('x-rlvo-og-key'),key);
 if(og===revision&&ogStatus===200&&body.op==='bytes')return binary(source);
 return Response.json(og,{status:ogStatus});
 };try{await fn();}finally{globalThis.fetch=original;}}

test('STAGING manifest default OFF even with complete flags',async()=>mocked(async()=>{
 const worker=fixture(null);const response=await worker.fetch(req(),env);assert.equal(response.status,200);assert((await response.text()).includes('/og/rlvo-paleta-06.png'));assert.equal(calls.length,1);
 assert.equal((await worker.fetch(req(image),env)).status,404);assert.equal(calls.length,1);
}));
test('STAGING allowlist denies nonfixture images before any backend call',async()=>mocked(async()=>{
 const worker=fixture(),other='B'.repeat(22);assert.equal((await worker.fetch(req('/p/'+other+'/og/'+rev),env)).status,404);assert.equal(calls.length,0);
 const page=await worker.fetch(req('/p/'+other),env);assert.equal(page.status,200);assert((await page.text()).includes('/og/rlvo-paleta-06.png'));assert.equal(calls.length,1);assert.equal(calls[0].url,EP.preview);
}));
test('STAGING allowlist gate ignores forged headers and environment manifests',async()=>mocked(async()=>{
 const other='B'.repeat(22);const r=req('/p/'+other+'/og/'+rev,{headers:{Host:'127.0.0.1',Forwarded:'host=127.0.0.1;for=127.0.0.1','x-forwarded-for':'127.0.0.1','x-forwarded-host':m.STAGING_ORIGIN,'SHARE_OG_ENABLED':'true','x-rlvo-og-key':key}});
 const e={...env,ogLocalTesting:true,readOgConfig:()=>({state:'active'}),tokens:[other]};assert.equal((await fixture().fetch(r,e)).status,404);assert.equal(calls.length,0);
 for(const p of [image+'?x=1',image+'?',image+'/',image.replace('/og/','/%6fg/'),image+'/x'])assert.equal((await fixture().fetch(req(p),env)).status,404);
 assert.equal((await fixture().fetch(new Request('https://www.rlvo.com.mx'+image),env)).status,404);assert.equal(calls.length,0);
}));
test('STAGING bounded manifest validates structure and time on each request',()=>{
 for(const data of [null,{}, {...manifest,extra:true},{...manifest,projectRef:'other'},{...manifest,projectRef:''},{...manifest,projectRef:PROJECT.toUpperCase()},{...manifest,projectRef:PROJECT+'.evil.example'},{...manifest,tokens:[]},{...manifest,tokens:[token,token]},{...manifest,tokens:['bad']},{...manifest,expiresAt:new Date(start+7200001).toISOString()},{...manifest,expiresAt:manifest.startsAt}])assert.equal(m.stagingFixtureGate(data,()=>start+1)(req(image)),false);
 for(const t of [start-1,end,NaN,Infinity])assert.equal(m.stagingFixtureGate(manifest,()=>t)(req()),false);
 assert.equal(m.stagingFixtureGate(manifest,()=>start)(req()),true);
 let now=start+1;const gate=m.stagingFixtureGate(manifest,()=>now);assert(gate(req(image)));now=end;assert.equal(gate(req(image)),false);
 assert.equal(gate(req('/u/'+token)),false);
});
test('STAGING pins endpoint and rejects missing, reused and invalid credentials',async()=>mocked(async()=>{
 for(const overrides of [{SHARE_OG_KEY_CURRENT:undefined},{SHARE_OG_KEY_CURRENT:env.SHARE_PREVIEW_KEY_CURRENT},{SHARE_OG_KEY_CURRENT:'short'},{SHARE_OG_KEY_CURRENT:key+'\n'},{SHARE_OG_SOURCE_URL:'https://example.com/functions/v1/share-og-source'},{SHARE_OG_SOURCE_URL:EP.source+'?x=1'},{SHARE_OG_SOURCE_URL:''},{SHARE_OG_SOURCE_URL:undefined},{SHARE_OG_SOURCE_URL:OTHER_EP.source},{SHARE_OG_SOURCE_URL:EP.source.replace('https:','http:')},{SHARE_LINKS_ENV:'local'}]){
  calls=[];assert.equal((await fixture().fetch(req(image),{...env,...overrides})).status,503);assert.equal(calls.length,0);
 }
 for(const flag of [undefined,'false']){calls=[];const r=await fixture().fetch(req(),{...env,SHARE_OG_ENABLED:flag});assert.equal(r.status,200);assert.equal(calls.length,1);}
}));
test('STAGING approved fixture produces revisioned metadata and bounded JPEG GET HEAD',async()=>mocked(async()=>{
 const worker=fixture();const r=await worker.fetch(req(),env);assert.equal(r.status,200);const html=await r.text();assert(html.includes(m.STAGING_ORIGIN+image));assert(html.includes('rel="canonical" href="'+m.STAGING_ORIGIN+page+'"'));assert(html.includes('property="og:url" content="'+m.STAGING_ORIGIN+page+'"'));
 assert.deepEqual(calls.map(c=>c.body.op??c.body.tipo),['p','rev']);
 for(const method of ['GET','HEAD']){const r=await worker.fetch(req(image,{method}),env);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');assert.equal(r.headers.get('cache-control'),'no-store');for(const h of ['x-rlvo-og-key','x-rlvo-og-rev','set-cookie'])assert.equal(r.headers.get(h),null);const bytes=await r.arrayBuffer();assert.equal(bytes.byteLength>0,method==='GET');}
 assert.equal((await worker.fetch(req(image,{method:'POST'}),env)).status,405);
 assert(!html.includes(key));assert(!html.includes('supabase.co'));assert(!html.includes('storage/'));
}));
test('STAGING revocation and technical errors never become successful brand fallbacks',async()=>mocked(async()=>{
 const worker=fixture();assert.equal((await worker.fetch(req(),env)).status,200);
 og=unavailable;ogStatus=404;assert.equal((await worker.fetch(req(image),env)).status,404);const revoked=await worker.fetch(req(),env);assert.equal(revoked.status,404);assert(!(await revoked.text()).includes('Fixture sintético'));
 og={error:'rev_distinta'};ogStatus=409;assert.equal((await worker.fetch(req(image),env)).status,409);
 for(const status of [400,401,413,503]){og={error:'no_disponible_temporalmente'};ogStatus=status;const r=await worker.fetch(req(image),env);assert.equal(r.status,503);assert.equal(await r.text(),'');assert.equal(r.headers.get('cache-control'),'no-store');const page=await worker.fetch(req(),env);assert.equal(page.status,503);assert(!(await page.text()).includes('og:image'));}
}));
test('STAGING legitimate absence preserves fallback bytes and profiles',async()=>mocked(async()=>{
 og=none;const r=await fixture().fetch(req(image),env);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),readFileSync('public/og/rlvo-paleta-06.png'));
 profile=true;const baseline=await fixture(null,()=>start+1,true).fetch(req('/u/'+token),env);const next=await fixture().fetch(req('/u/'+token),env);assert.equal(await baseline.text(),await next.text());
}));
test('STAGING expiry prevents cached old revision retrieval and production entry remains OFF',async()=>mocked(async()=>{
 let time=start+1;const worker=fixture(manifest,()=>time);assert.equal((await worker.fetch(req(image),env)).status,200);calls=[];time=end;assert.equal((await worker.fetch(req(image),env)).status,404);assert.equal(calls.length,0);
 const normal=fixture(null,()=>start+1,true);assert.equal((await normal.fetch(req(image),env)).status,404);const html=await (await normal.fetch(req(),env)).text();assert(html.includes('/og/rlvo-paleta-06.png'));assert.equal(calls.length,1);
}));
test('STAGING private configuration: missing, invalid or unbound projects fail closed without egress',async()=>mocked(async()=>{
 // Versioned default entry: empty manifest and the real V1 pin. Never activates OG, even with full flags.
 for(const vars of [env,{...env,SHARE_PREVIEW_URL:''}]){attempts=[];const r=await fixture(manifest,()=>start+1,false,{'x-test-default':'1'}).fetch(req(image),vars);assert.equal(r.status,404);assert.equal(attempts.length,0);}
 // Pin mismatch (fictitious endpoint against a different compiled pin): V1 config invalid, no egress.
 attempts=[];assert.equal((await fixture(manifest,()=>start+1,false,{'x-test-pin':'0'.repeat(64)}).fetch(req(image),env)).status,503);assert.equal(attempts.length,0);
 // Missing preview endpoint in the private session config: invalid, no egress.
 attempts=[];assert.equal((await fixture().fetch(req(image),{...env,SHARE_PREVIEW_URL:''})).status,503);assert.equal(attempts.length,0);
 // Manifest project not bound to the pinned preview project, even with a consistent OG source: invalid, no egress.
 const other={...manifest,projectRef:OTHER};
 for(const source of [EP.source,OTHER_EP.source]){attempts=[];assert.equal((await fixture(other).fetch(req(image),{...env,SHARE_OG_SOURCE_URL:source})).status,503);assert.equal(attempts.length,0);
  const page=await fixture(other).fetch(req(),{...env,SHARE_OG_SOURCE_URL:source});assert.equal(page.status,503);assert(!(await page.text()).includes('og:image'));assert(attempts.every(u=>u===EP.preview));}
 // Request-controlled values never choose the backend origin.
 attempts=[];const forged=req(image,{headers:{'x-forwarded-host':OTHER+'.supabase.co',Host:OTHER+'.supabase.co','x-test-vars-override':OTHER_EP.source}});
 assert.equal((await fixture().fetch(forged,env)).status,200);assert(attempts.length>0&&attempts.every(u=>u===EP.source));
}));
test('STAGING versioned files never carry a real project ref or backend endpoint',()=>{
 const host=/[a-z0-9]{20}\.supabase\.co/;
 for(const f of ['worker/og-staging-policy.ts','worker/og-staging.ts','worker/og-staging-fixtures.json','wrangler.share-links.og.staging.jsonc'])assert(!host.test(readFileSync(resolve(root,f),'utf8')),f);
 const versioned=JSON.parse(readFileSync(resolve(root,'worker/og-staging-fixtures.json'),'utf8'));assert.deepEqual(versioned.tokens,[]);assert.equal(versioned.projectRef,'');assert.equal(m.stagingSessionProject(versioned),null);
 const cfg=JSON.parse(readFileSync(resolve(root,'wrangler.share-links.og.staging.jsonc'),'utf8').replace(/^\s*\/\/.*$/gm,''));
 assert.equal(cfg.vars.SHARE_PREVIEW_URL,'');assert.equal(cfg.vars.SHARE_OG_SOURCE_URL,'');assert.equal(cfg.vars.SHARE_OG_ENABLED,'false');assert.equal(cfg.vars.SHARE_LINKS_ENABLED,'false');assert.equal(cfg.workers_dev,false);assert.equal(cfg.preview_urls,false);
});
