import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {modules,token,rev,key,cfg,previewCfg,envVars,path,request,json,none,unavailable,revision,source,binary,codec,composed} from './og-fixture.mjs';
const m=await modules();
const localConfig=(env,preview,req)=>m.readOgConfig(env,preview,req,true);
const getRev=(response,timeout=100)=>m.loadOgRev(cfg,token,async()=>response(),timeout);
const getBytes=(response,timeout=100)=>m.loadOgBytes(cfg,token,rev,async()=>response(),timeout);

test('OG parser exact and case-sensitive',()=>assert.deepEqual(m.ogRoute(request().url),{token,rev}));
for(const bad of [path+'/',path+'/x',path+'?x=1',path+'?',path+'#x',path.replace('/og/','//og/'),path.replace('/og/','/%6fg/'),path.replace(token,'%41'+token.slice(1)),path.replace(rev,rev.toUpperCase()),path.replace('/og/','/./og/'),path.replace('/og/','/../og/'),path.replace('/og/','/og;/'),path.replace('/og/','\\og/'),path+'\n'])
 test('OG rejects raw ambiguous path '+JSON.stringify(bad),()=>assert.equal(m.ogRoute(previewCfg.origin+bad),null));
test('OG flag OFF default, explicit false, valid local ON',()=>{
 assert.equal(localConfig({},previewCfg,request()).state,'disabled');
 assert.equal(localConfig({...envVars,SHARE_OG_ENABLED:'false'},previewCfg,request()).state,'disabled');
 assert.equal(localConfig(envVars,previewCfg,request()).state,'active');
});
for(const override of [{SHARE_OG_ENABLED:'TRUE'},{SHARE_LINKS_ENV:'staging'},{SHARE_LINKS_ENV:'production'},{SHARE_OG_KEY_CURRENT:''},{SHARE_OG_KEY_CURRENT:previewCfg.key},{SHARE_OG_SOURCE_URL:'https://private.invalid/storage/secret'},{SHARE_OG_SOURCE_URL:cfg.endpoint+'?'},{SHARE_OG_SOURCE_URL:cfg.endpoint+'/'},{SHARE_OG_SOURCE_URL:'http://localhost:8902/functions/v1/share-og-source'}])
 test('OG local configuration fails closed '+JSON.stringify(Object.keys(override)),()=>assert.equal(localConfig({...envVars,...override},previewCfg,request()).state,'invalid'));
test('remote incoming URL cannot enable OG',()=>assert.equal(localConfig(envVars,previewCfg,new Request('https://public.invalid'+path)).state,'invalid'));
test('normal entry opt-in cannot be supplied by any request or runtime binding',()=>{
 for(const origin of [previewCfg.origin,'https://public.invalid','https://www.rlvo.com.mx']){
  const req=new Request(origin+path+'?SHARE_OG_ENABLED=true&ogLocalTesting=true',{headers:{
   host:'127.0.0.1:8901','x-forwarded-for':'127.0.0.1',forwarded:'for=127.0.0.1;host=127.0.0.1:8901;proto=http',
   'x-forwarded-host':'127.0.0.1:8901','x-forwarded-proto':'http','x-real-ip':'127.0.0.1','SHARE_OG_ENABLED':'true','ogLocalTesting':'true',
  }});
  assert.equal(m.readOgConfig({...envVars,ogLocalTesting:true},previewCfg,req).state,'disabled');
 }
});
test('local entry rejects public request URL despite forged loopback headers',()=>{
 const req=new Request('https://public.invalid'+path,{headers:{host:'127.0.0.1:8901','x-forwarded-for':'127.0.0.1',forwarded:'host=127.0.0.1:8901;proto=http'}});
 assert.equal(localConfig(envVars,previewCfg,req).state,'invalid');
});
test('partial local configurations remain inactive and normal entry always disabled',()=>{
 for(const e of [{},{SHARE_OG_ENABLED:'false'},{SHARE_OG_SOURCE_URL:cfg.endpoint},{SHARE_OG_KEY_CURRENT:key},{SHARE_OG_ENABLED:'true'},
  {...envVars,SHARE_OG_SOURCE_URL:undefined},{...envVars,SHARE_OG_KEY_CURRENT:undefined},
  {...envVars,SHARE_LINKS_ENV:'staging'},{...envVars,SHARE_LINKS_ENV:'production'}]){
  assert.equal(m.readOgConfig(e,previewCfg,request()).state,'disabled');
  assert.notEqual(localConfig(e,previewCfg,request()).state,'active');
 }
});
test('operations use exact private contract, independent key, no retries',async()=>{
 for(const op of ['rev','bytes']) {
  let calls=0;
  const upstream=async(url,init)=>{calls++;assert.equal(url,cfg.endpoint);assert.equal(init.method,'POST');assert.equal(init.redirect,'manual');
   assert.deepEqual(init.headers,{'Content-Type':'application/json','X-RLVO-Og-Key':key});
   assert.deepEqual(JSON.parse(init.body),op==='rev'?{v:1,op,token}:{v:1,op,token,rev});assert(Buffer.byteLength(init.body)<=512);
   return op==='rev'?json(revision):binary();};
  const result=op==='rev'?await m.loadOgRev(cfg,token,upstream):await m.loadOgBytes(cfg,token,rev,upstream);
  assert.equal(result.kind,op==='rev'?'revision':'image');assert.equal(calls,1);
 }
});
for(const op of ['rev','bytes']) for(const [body,status,kind] of [[none,200,'none'],[unavailable,404,'unavailable'],[{error:'rev_distinta'},409,op==='bytes'?'conflict':'temporary']])
 test(`OG ${op}: exact response ${status}/${kind}`,async()=>assert.equal((await (op==='rev'?getRev:getBytes)(()=>json(body,status))).kind,kind));
for(const body of [{...revision,storage_path:'PRIVATE_STORAGE'},{...none,rev},{v:2,disponible:true,imagen:false},{v:1,disponible:false},{...revision,rev:'A'.repeat(32)},{...revision,rev:rev+'\n'},[],null])
 test('OG rejects JSON schema '+JSON.stringify(body),async()=>assert.equal((await getRev(()=>json(body))).kind,'temporary'));
for(const status of [200,400,401,405,413,429,500,503,301,302,307,308])
 test('OG errors cannot be mistaken for fallback '+status,async()=>assert.equal((await getBytes(()=>json({error:'PRIVATE_INTERNAL'},status))).kind,'temporary'));
for(const [name,make] of [
 ['missing revision',()=>binary(source,{'x-rlvo-og-rev':''})],
 ['wrong revision',()=>binary(source,{'x-rlvo-og-rev':'b'.repeat(32)})],
 ['missing length',()=>{const r=binary();r.headers.delete('content-length');return r;}],
 ['short body',()=>binary(source,{'content-length':String(source.length+1)})],
 ['excess body',()=>binary(source,{'content-length':String(source.length-1)})],
 ['huge declaration',()=>binary(source,{'content-length':'5242881'})],
 ['bad number',()=>binary(source,{'content-length':'1e3'})],
 ['MIME spoof',()=>binary(source,{'content-type':'image/jpeg'})],
 ['SVG source',()=>binary(Buffer.from('<svg/>'),{'content-type':'image/svg+xml'})],
 ['truncated PNG',()=>binary(source.subarray(0,-5))],
 ['invalid PNG CRC',()=>{const b=Buffer.from(source);b[30]^=1;return binary(b);}],
 ['malformed JSON',()=>new Response('{',{headers:{'content-type':'application/json'}})],
 ['UTF8',()=>new Response(new Uint8Array([255]),{headers:{'content-type':'application/json'}})],
 ['oversize JSON',()=>new Response(' '.repeat(513),{headers:{'content-type':'application/json'}})],
]) test('OG invalid response '+name,async()=>assert.equal((await getBytes(make)).kind,'temporary'));
test('effective binary read cap cancels even when declared size lies',async()=>{
 let cancelled=false,pulls=0;
 const r=new Response(new ReadableStream({pull(c){pulls++;if(pulls<=7)c.enqueue(new Uint8Array(1024*1024));else c.close();},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png','content-length':'5242880','x-rlvo-og-rev':rev}});
 assert.equal((await getBytes(()=>r)).kind,'temporary');assert(cancelled);assert(pulls<=7);
});
for(const mode of ['headers','body'])test('OG deadline aborts '+mode,async()=>{
 let signal,cancelled=false;
 const upstream=async(_url,init)=>{signal=init.signal;if(mode==='headers')return new Promise(()=>{});
  return new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}}),{headers:{'content-type':'image/png','content-length':'10','x-rlvo-og-rev':rev}});};
 assert.equal((await m.loadOgBytes(cfg,token,rev,upstream,20)).kind,'temporary');assert(signal.aborted);if(mode==='body')assert(cancelled);
});
test('late upstream response is cancelled after deadline',async()=>{
 let cancelled=false;
 await m.loadOgRev(cfg,token,async()=>{await new Promise(r=>setTimeout(r,30));return new Response(new ReadableStream({cancel(){cancelled=true;}}));},5);
 await new Promise(r=>setTimeout(r,40));assert(cancelled);
});
test('network exception sanitized',async()=>assert.equal((await m.loadOgBytes(cfg,token,rev,async()=>{throw Error(key);},100)).kind,'temporary'));
for(const [mime,format] of [['image/jpeg','jpeg'],['image/png','png'],['image/webp','webp']])test('OG valid container '+mime,async()=>{
 const b=await sharp(source)[format]().toBuffer();const result=await getBytes(()=>binary(b,{'content-type':mime}));assert.equal(result.kind,'image');assert.deepEqual(Buffer.from(result.bytes),b);
});
test('composition requests pad, opaque JPEG and official badge; strips APP/COM',async()=>{
 const spy=[];
 const xmp=Buffer.from('http://ns.adobe.com/xap/1.0/\0PRIVATE_XMP_GPS');
 const segment=Buffer.alloc(xmp.length+4);segment[0]=255;segment[1]=225;segment.writeUInt16BE(xmp.length+2,2);xmp.copy(segment,4);
 const output=Buffer.concat([composed.subarray(0,2),segment,composed.subarray(2)]);
 const got=await m.composeOg(codec({spy,output}),source,new AbortController().signal);
 assert(!Buffer.from(got).includes(Buffer.from('PRIVATE_XMP_GPS')));
 assert.deepEqual(spy.find(x=>x.transform).transform,{width:1200,height:630,fit:'pad',background:'#F5FAF8',metadata:'none'});
 assert.deepEqual(spy.find(x=>x.draw).draw,{right:32,bottom:32,opacity:1,composite:'over'});
 assert.deepEqual(spy.find(x=>x.output).output,{format:'image/jpeg',quality:85,anim:false});
 const badge=await new Response(spy.find(x=>x.badge).badge).arrayBuffer();const meta=await sharp(Buffer.from(badge)).metadata();assert.equal(meta.width,240);assert.equal(meta.height,90);
 const result=await sharp(got).metadata();assert.equal(result.width,1200);assert.equal(result.height,630);assert.equal(result.hasAlpha,false);assert.equal(result.exif,undefined);assert.equal(result.xmp,undefined);
});
test('compressed corruption that passes container checks fails decode safely',async()=>{
 const b=Buffer.from(source);b.fill(0xff,41,b.length-12);
 // JPEG container with valid SOF/SOS but no decodable compressed pixels.
 const bad=Buffer.from([255,216,255,192,0,11,8,1,44,1,144,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,2,3,255,217]);
 assert(m.imageInfo(bad,'image/jpeg'));
 await assert.rejects(()=>m.composeOg(codec(),bad,new AbortController().signal));
});
test('JPEG with trailing data and PNG without IEND rejected',()=>{
 assert.equal(m.imageInfo(Buffer.concat([composed,Buffer.from('PRIVATE')]),'image/jpeg'),null);
 assert.equal(m.imageInfo(source.subarray(0,-12),'image/png'),null);
});

// Handler contract tests use synthetic fetch and a local codec, not Cloudflare Images.
async function withHandler(body,run,{images=codec(),extraHeaders={}}={}) {
 const old=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});const r=typeof body==='function'?body():json(body);for(const[k,v]of Object.entries(extraHeaders))r.headers.set(k,v);return r;};
 const fallback=readFileSync('public/og/rlvo-paleta-06.png');
 const env={IMAGES:images,ASSETS:{fetch:async()=>new Response(fallback,{headers:{'content-type':'image/png'}})}};
 try{return await run(m.createOgHandler(),env,calls,fallback);}finally{globalThis.fetch=old;}
}
test('public handler 200 image, HEAD and no private headers',async()=>withHandler(()=>binary(),async(handler,env,calls)=>{
 const a=await handler(request(),env,cfg);assert.equal(a.status,200);assert.equal(a.headers.get('content-type'),'image/jpeg');
 for(const h of ['x-rlvo-og-key','x-rlvo-og-rev','set-cookie'])assert.equal(a.headers.get(h),null);
 assert.equal(a.headers.get('cache-control'),'no-store');assert(!(await a.text()).includes(key));
 const h=await handler(request('HEAD'),env,cfg);assert.equal(h.status,200);assert.equal(await h.text(),'');assert(Number(h.headers.get('content-length'))>0);assert.equal(calls.length,2);
}));
test('public handler fallback byte-identical only on valid imagen:false',async()=>withHandler(none,async(handler,env,_calls,fallback)=>{
 const r=await handler(request(),env,cfg);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),fallback);
}));
test('public handler compressed corruption fails decoding with 503',async()=>{
 const bad=Buffer.from([255,216,255,192,0,11,8,1,44,1,144,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,2,3,255,217]);
 await withHandler(()=>binary(bad,{'content-type':'image/jpeg'}),async(handler,env)=>{
  const r=await handler(request(),env,cfg);assert.equal(r.status,503);assert.equal(await r.text(),'');
 });
});
test('OG dimension bound is independent of declared MIME and length',async()=>{
 const large=await sharp({create:{width:4097,height:200,channels:3,background:'white'}}).png().toBuffer();
 assert.equal((await getBytes(()=>binary(large))).kind,'temporary');
});
test('OG key with trailing newline is rejected',()=>assert.equal(localConfig({...envVars,SHARE_OG_KEY_CURRENT:key+'\n'},previewCfg,request()).state,'invalid'));
for(const [status,body,expected] of [[404,unavailable,404],[409,{error:'rev_distinta'},409],[503,{error:'no_disponible_temporalmente'},503],[401,{error:'no_autorizado'},503],[400,{error:'solicitud_invalida'},503],[413,{error:'cuerpo_excesivo'},503]])
 test('public handler status '+status+' never successful fallback',async()=>withHandler(()=>json(body,status),async(handler,env)=>{
  for(const method of ['GET','HEAD']){const r=await handler(request(method),env,cfg);assert.equal(r.status,expected);assert.equal((await r.arrayBuffer()).byteLength,0);assert.equal(r.headers.get('content-type'),null);assert.equal(r.headers.get('cache-control'),'no-store');}
 }));
test('public handler composition failure returns 503 without source',async()=>withHandler(()=>binary(),async(handler,env)=>{
 const r=await handler(request(),env,cfg);assert.equal(r.status,503);assert.equal(await r.text(),'');
},{images:codec({failure:true})}));
test('public handler rejects invalid routes and methods before upstream',async()=>withHandler(none,async(handler,env,calls)=>{
 assert.equal((await handler(request('GET','?x=1'),env,cfg)).status,404);
 const r=await handler(request('POST'),env,cfg);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');assert.equal(calls.length,0);
}));
test('composition saturation fails closed and slot recovers',async()=>{
 const old=globalThis.fetch;let release;let entered;
 const pending=new Promise(r=>{entered=r;});
 globalThis.fetch=async()=>{entered();await new Promise(r=>{release=r;});return binary();};
 const handler=m.createOgHandler(),env={IMAGES:codec()};
 try{const a=handler(request(),env,cfg);await pending;assert.equal((await handler(request(),env,cfg)).status,503);release();assert.equal((await a).status,200);
 globalThis.fetch=async()=>binary();assert.equal((await handler(request(),env,cfg)).status,200);
 }finally{globalThis.fetch=old;}
});
