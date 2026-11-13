import { createServer } from 'node:http';
import { once } from 'node:events';
import { createServer as netServer } from 'node:net';
export const token='A'.repeat(22);
export const key='synthetic-local-preview-key-0000000000000000';
export const publication={v:1,tipo:'publicacion',disponible:true,titulo:'Libro de cálculo',precio_mxn:1200};
export const profile={v:1,tipo:'perfil',disponible:true,nombre_publico:'Ana L.'};

export async function fixture(overrides={}) {
 const state={calls:[],mode:'normal',data:publication,closed:0};
 const timers=new Set();
 const backend=createServer(async(req,res)=>{
  const chunks=[];for await (const c of req) chunks.push(c);
  state.calls.push({method:req.method,path:req.url,headers:req.headers,body:Buffer.concat(chunks).toString()});
  res.on('close',()=>{state.closed++;});
  if(state.mode==='network'){res.destroy();return;}
  if(state.mode==='slow-headers'){const t=setTimeout(()=>{timers.delete(t);if(!res.destroyed)res.end('{}');},15000);timers.add(t);return;}
  res.setHeader('Content-Type','application/json');
  res.setHeader('Set-Cookie','internal-fixture=private');
  res.setHeader('sb-error-code','INTERNAL_FIXTURE');
  res.setHeader('access-control-expose-headers','sb-error-code');
  if(state.mode==='slow-body'){res.writeHead(200);res.write('{"v":');return;}
  if(state.mode==='truncate'){res.setHeader('content-length','999');res.write('{"v":');res.socket?.destroy();return;}
  if(typeof state.mode==='number'){res.statusCode=state.mode;res.end('{"internal":"private-fixture"}');return;}
  if(state.mode==='redirect'){res.statusCode=302;res.setHeader('Location','http://127.0.0.1:'+backend.address().port+'/forbidden');res.end();return;}
  if(state.mode==='bad-json'){res.end('{');return;}
  if(state.mode==='bad-type')res.setHeader('Content-Type','text/plain');
  if(state.mode==='large'){res.end('x'.repeat(4097));return;}
  res.end(JSON.stringify(state.data));
 });
 backend.listen(0,'127.0.0.1');await once(backend,'listening');
 const reserve=netServer().listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;
 await new Promise(r=>reserve.close(r));
 const origin='http://127.0.0.1:'+port;
 process.env.WRANGLER_SEND_METRICS='false';
 process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false';
 const {unstable_dev}=await import('wrangler');
 let worker;
 try{
  worker=await unstable_dev('worker/index.ts',{config:'wrangler.share-links.jsonc',local:true,port,ip:'127.0.0.1',
   persist:false,logLevel:'none',
   vars:{SHARE_LINKS_ENABLED:'true',SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:origin,
    SHARE_PREVIEW_URL:'http://127.0.0.1:'+backend.address().port+'/functions/v1/share-preview',
    SHARE_PREVIEW_KEY_CURRENT:key,...overrides},
   experimental:{disableExperimentalWarning:true,disableDevRegistry:true,forceLocal:true,watch:false}});
 }catch(e){for(const t of timers)clearTimeout(t);backend.closeAllConnections();await new Promise(r=>backend.close(r));throw e;}
 return {state,origin,worker, async stop(){
  try{await worker.stop();}finally{for(const t of timers)clearTimeout(t);backend.closeAllConnections();await new Promise(r=>backend.close(r));}
 }};
}
