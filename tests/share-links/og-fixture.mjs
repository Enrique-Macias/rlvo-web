import { build } from 'esbuild';
import { resolve } from 'node:path';
import sharp from 'sharp';
export const token = 'A'.repeat(22), rev = 'a'.repeat(32);
export const key = 'synthetic-og-key-000000000000000000000000';
export const cfg = { endpoint: 'http://127.0.0.1:8902/functions/v1/share-og-source', key };
export const previewCfg = { origin: 'http://127.0.0.1:8901', endpoint: 'http://127.0.0.1:8902/functions/v1/share-preview', key: 'preview-key-'.repeat(4) };
export const envVars = {SHARE_LINKS_ENABLED:'true',SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:previewCfg.origin,
 SHARE_PREVIEW_URL:previewCfg.endpoint,SHARE_PREVIEW_KEY_CURRENT:previewCfg.key,SHARE_OG_ENABLED:'true',SHARE_OG_SOURCE_URL:cfg.endpoint,SHARE_OG_KEY_CURRENT:key};
export const path = '/p/'+token+'/og/'+rev;
export const request = (method='GET',suffix='') => new Request(previewCfg.origin+path+suffix,{method});
export const json = (data,status=200) => Response.json(data,{status});
export const none = {v:1,disponible:true,imagen:false};
export const unavailable = {v:1,disponible:false};
export const revision = {v:1,disponible:true,imagen:true,rev};
export const source = await sharp({create:{width:400,height:600,channels:3,background:'#ca3344'}}).png().toBuffer();
export const composed = await sharp(source).resize(1200,630,{fit:'contain',background:'#F5FAF8'}).jpeg().toBuffer();
export const binary = (bytes=source,overrides={}) => new Response(bytes,{headers:{'content-type':'image/png','content-length':String(bytes.length),'x-rlvo-og-rev':rev,...overrides}});
export async function modules(root=process.env.OG_MODULE_ROOT??process.cwd()) {
 const exports=['og-config','og-source','og-image','og-compose','og-handler'];
 const contents=exports.map(f=>`export * from ${JSON.stringify(resolve(root,'worker',f+'.ts'))};`).join('\n');
 const result=await build({stdin:{contents,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
export function codec({failure=false,output=composed,spy=[]}={}) {
 return {input(stream){spy.push({input:stream});return {
  transform(options){spy.push({transform:options});return this;},
  draw(badge,options){spy.push({draw:options,badge});return this;},
  async output(options){spy.push({output:options});
   if(failure)throw Error('PRIVATE_INTERNAL_CODEC_FAILURE');
   // Actually decode the source in the local test codec; never claim this validates Cloudflare's overlay.
   await sharp(Buffer.from(await new Response(stream).arrayBuffer())).raw().toBuffer();
   return {response:()=>new Response(output,{headers:{'content-type':'image/jpeg','x-rlvo-og-key':key,'set-cookie':'private=true'}})};
  }
 };}};
}
