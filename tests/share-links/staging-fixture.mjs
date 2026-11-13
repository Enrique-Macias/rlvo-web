import {build} from 'esbuild';
import {Miniflare,Response as MockResponse,Log,LogLevel,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export const stagingOrigin='https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev';
export const syntheticEndpoint='https://syntheticstaging0000.supabase.co/functions/v1/share-preview';
export const stagingToken='S'.repeat(22);
export const stagingKey='synthetic-w2-preview-key-000000000000000000';
export const stagingPublication={v:1,tipo:'publicacion',disponible:true,titulo:'Libro sintético W2',precio_mxn:1200};
export const stagingProfile={v:1,tipo:'perfil',disponible:true,nombre_publico:'Prueba S.'};
const bundles=new Map();
async function bundle(sealed){
 if(!bundles.has(sealed)){
  const pin=createHash('sha256').update(syntheticEndpoint).digest('hex');
  const contents=sealed ? "export {default} from './worker/staging.ts';" :
   "import {createStagingWorker} from './worker/staging.ts';import {createStagingPolicy} from './worker/staging-policy.ts';export default createStagingWorker(createStagingPolicy('"+pin+"'));";
  const result=await build({stdin:{contents,resolveDir:process.cwd(),sourcefile:'w2-local-test-entry.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
  bundles.set(sealed,result.outputFiles[0].text);
 }
 return bundles.get(sealed);
}
export async function stagingFixture(overrides={}, {sealed=false,endpoint=syntheticEndpoint}={}){
 const config=JSON.parse(readFileSync('wrangler.share-links.staging.jsonc','utf8'));
 const state={calls:[],denied:0,mode:'normal',data:stagingPublication,cancelled:0,aborted:0,externalConnections:0};
 const timers=new Set();
 const vars={...config.vars,SHARE_LINKS_ENABLED:'true',SHARE_PREVIEW_URL:endpoint,SHARE_PREVIEW_KEY_CURRENT:stagingKey,...overrides};
 const outbound=async request=>{
  if(request.url!==endpoint){state.denied++;return new MockResponse('blocked-by-local-egress',{status:503});}
  state.calls.push({method:request.method,path:new URL(request.url).pathname,headers:Object.fromEntries(request.headers),body:await request.text()});
  request.signal.addEventListener('abort',()=>{state.aborted++;},{once:true});
  const headers={'content-type':'application/json','set-cookie':'upstream=synthetic','sb-error-code':'PRIVATE_SYNTHETIC','access-control-expose-headers':'sb-error-code'};
  if(state.mode==='network')throw Error('synthetic network failure');
  if(state.mode==='slow-headers')return new Promise(r=>{const t=setTimeout(()=>{timers.delete(t);r(new MockResponse('{}',{headers}));},15000);timers.add(t);});
  if(state.mode==='slow-body')return new MockResponse(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"v":'));},pull(){return new Promise(()=>{});},cancel(){state.cancelled++;}}),{headers});
  if(state.mode==='redirect')return new MockResponse('',{status:302,headers:{location:'https://denied-w2.invalid/redirect'}});
  if(typeof state.mode==='number')return new MockResponse('PRIVATE_SYNTHETIC',{status:state.mode,headers});
  if(state.mode==='large')return new MockResponse('x'.repeat(4097),{headers});
  if(state.mode==='bad-json')return new MockResponse('{',{headers});
  if(state.mode==='bad-type')return new MockResponse(JSON.stringify(state.data),{headers:{'content-type':'text/html'}});
  if(state.mode==='truncate')return new MockResponse('{}',{headers:{...headers,'content-length':'99'}});
  return new MockResponse(JSON.stringify(state.data),{headers});
 };
 // This function handles EVERY Worker global fetch. It never invokes fetch, DNS or sockets.
 // Unmatched requests are rejected rather than sent through a native network service.
 const mf=new Miniflare(convertV4MiniflareOptions({
  host:'127.0.0.1',port:0,cf:false,log:new Log(LogLevel.NONE),logRequests:false,
  modules:true,script:await bundle(sealed),compatibilityDate:config.compatibility_date,bindings:Object.fromEntries(Object.entries(vars).filter(([,v])=>v!==undefined)),
  assets:{directory:resolve(config.assets.directory),binding:config.assets.binding,run_worker_first:config.assets.run_worker_first,
   routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},
   assetConfig:{html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling}},
  outboundService:outbound,
 }));
 try{
  const origin=(await mf.ready).origin;
  return {state,origin,vars,async stop(){try{await mf.dispose();}finally{for(const t of timers)clearTimeout(t);timers.clear();}}};
 }catch(e){await mf.dispose();for(const t of timers)clearTimeout(t);throw e;}
}
