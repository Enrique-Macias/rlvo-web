import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readConfig,PREVIEW_PATH} from '../../worker/config.ts';
import {createStagingPolicy,endpointMatches,STAGING_ENDPOINT_SHA256,STAGING_ORIGIN} from '../../worker/staging-policy.ts';
const endpoint='https://syntheticstaging0000.supabase.co'+PREVIEW_PATH;
const pin=createHash('sha256').update(endpoint).digest('hex');
const policy=createStagingPolicy(pin);
const env={SHARE_LINKS_ENABLED:'true',SHARE_LINKS_ENV:'staging',SHARE_LINKS_PUBLIC_ORIGIN:STAGING_ORIGIN,
 SHARE_PREVIEW_URL:endpoint,SHARE_PREVIEW_KEY_CURRENT:'synthetic-w2-key-'.repeat(3)};
test('W2: pin compilado y origen aprobado exactos',()=>{
 assert.equal(STAGING_ENDPOINT_SHA256,'0a62d2a6775b0fb0b902127154b55adeae913273597a6af5047aa13c4dfdb1ab');
 assert.equal(STAGING_ORIGIN,'https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev');
});
test('W2: STAGING sintético válido solo mediante política de código del test',async()=>{
 assert.equal((await policy.readConfig(env)).state,'active');
 assert.equal((await createStagingPolicy().readConfig({...env,SHARE_PREVIEW_ENDPOINT_SHA256:pin})).state,'invalid');
});
test('W2: entradas y ambientes no se convierten entre sí',async()=>{
 assert.equal(readConfig(env).state,'invalid');
 const local={...env,SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:'http://127.0.0.1:1234',SHARE_PREVIEW_URL:'http://127.0.0.1:4321'+PREVIEW_PATH};
 assert.equal(readConfig(local).state,'active');assert.equal((await policy.readConfig(local)).state,'invalid');
});
for(const enabled of [undefined,'false'])test('W2: apagado precede configuración '+String(enabled),async()=>{
 assert.equal((await policy.readConfig({...env,SHARE_LINKS_ENABLED:enabled,SHARE_PREVIEW_URL:'bad'})).state,'disabled');
});
for(const [name,value] of [
 ['SHARE_LINKS_ENABLED','TRUE'],['SHARE_LINKS_ENABLED','1'],['SHARE_LINKS_ENV',undefined],['SHARE_LINKS_ENV','production'],['SHARE_LINKS_ENV','prod'],['SHARE_LINKS_ENV','preview'],['SHARE_LINKS_ENV','local'],
 ['SHARE_LINKS_PUBLIC_ORIGIN',undefined],['SHARE_LINKS_PUBLIC_ORIGIN',STAGING_ORIGIN+'/'],['SHARE_LINKS_PUBLIC_ORIGIN','https://www.rlvo.com.mx'],['SHARE_LINKS_PUBLIC_ORIGIN','https://rlvo.com.mx'],
 ['SHARE_LINKS_PUBLIC_ORIGIN','http://127.0.0.1:1234'],['SHARE_LINKS_PUBLIC_ORIGIN',STAGING_ORIGIN+':443'],['SHARE_LINKS_PUBLIC_ORIGIN',STAGING_ORIGIN+'?x=1'],
 ['SHARE_PREVIEW_KEY_CURRENT',undefined],['SHARE_PREVIEW_KEY_CURRENT','short'],['SHARE_PREVIEW_KEY_CURRENT','x'.repeat(257)],['SHARE_PREVIEW_KEY_CURRENT','x'.repeat(32)+'\n'],
 ['SHARE_PREVIEW_URL',undefined],['SHARE_PREVIEW_URL',endpoint.replace('https:','http:')],['SHARE_PREVIEW_URL',endpoint.replace('https://','https://x:y@')],
 ['SHARE_PREVIEW_URL',endpoint.replace('.co/','.co:443/')],['SHARE_PREVIEW_URL',endpoint.replace('.co/','.co:8443/')],['SHARE_PREVIEW_URL',endpoint+'?'],['SHARE_PREVIEW_URL',endpoint+'#'],
 ['SHARE_PREVIEW_URL',endpoint+'?token=synthetic'],['SHARE_PREVIEW_URL',endpoint+'#x'],['SHARE_PREVIEW_URL',endpoint+'/'],['SHARE_PREVIEW_URL',endpoint.replace('share-preview','other')],
 ['SHARE_PREVIEW_URL',endpoint.replace('syntheticstaging0000','syntheticstaging0001')],['SHARE_PREVIEW_URL',endpoint.replace('.co/','.co./')],
 ['SHARE_PREVIEW_URL',endpoint.replace('.co/','.co.evil.invalid/')],['SHARE_PREVIEW_URL',endpoint.replace('synthetic','SYNTHETIC')],
 ['SHARE_PREVIEW_URL',endpoint.replace('/functions/','/a/../functions/')],['SHARE_PREVIEW_URL',endpoint.replace('share-preview','%73hare-preview')],['SHARE_PREVIEW_URL',' '+endpoint]
])test('W2: configuración rechazada '+name+':'+String(value).length,async()=>assert.equal((await policy.readConfig({...env,[name]:value})).state,'invalid'));
test('W2: digest incorrecto y pin de formato inválido fallan cerrados',async()=>{
 for(const p of ['0'.repeat(64),'bad'])assert.equal(await endpointMatches(endpoint,p),false);
});

test('W2: deadline con configuración STAGING aborta señal y cancela cuerpo',async()=>{
 const {loadPreview}=await import('../../worker/share-preview.ts');
 const config=await policy.readConfig(env);assert.equal(config.state,'active');
 let cancelled=false,signal;
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}});
 const result=await loadPreview(config.config,'p','S'.repeat(22),async(_url,init)=>{signal=init.signal;return new Response(body,{headers:{'content-type':'application/json'}});},30);
 assert.equal(result,null);assert(signal.aborted);assert(cancelled);
});
