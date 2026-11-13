import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readConfig, shareRoute, isSharePath, MAX_RESPONSE_BYTES } from '../../worker/config.ts';
import { loadPreview, validatePreview } from '../../worker/share-preview.ts';
import { priceMxn } from '../../worker/format.ts';
const token = 'A'.repeat(22);
const cfg = { origin: 'http://127.0.0.1:8901', endpoint: 'http://127.0.0.1:8902/functions/v1/share-preview', key: 'fixture-key-'.repeat(4) };
const env = { SHARE_LINKS_ENABLED: 'true', SHARE_LINKS_ENV: 'local', SHARE_LINKS_PUBLIC_ORIGIN: cfg.origin,
 SHARE_PREVIEW_URL: cfg.endpoint, SHARE_PREVIEW_KEY_CURRENT: cfg.key };
const publication = { v: 1, tipo: 'publicacion', disponible: true, titulo: 'Libro', precio_mxn: 1200 };
const profile = { v: 1, tipo: 'perfil', disponible: true, nombre_publico: 'Ana L.' };
for (const [label, value, tipo] of [['publicación', publication, 'p'], ['perfil', profile, 'u'], ['no disponible', { v: 1, disponible: false }, 'p']])
 test('contrato válido: ' + label, () => assert.deepEqual(validatePreview(value, tipo), value));
for (const [label, value, tipo] of [
 ['versión', { ...publication, v: 2 }, 'p'], ['sin versión', { ...publication, v: undefined }, 'p'],
 ['tipo opuesto', profile, 'p'], ['discriminante', { ...publication, disponible: 1 }, 'p'],
 ['extra privado', { ...publication, correo: 'fixture@example.invalid' }, 'p'],
 ['falta precio', { v: 1, tipo: 'publicacion', disponible: true, titulo: 'Libro' }, 'p'],
 ['título vacío', { ...publication, titulo: '' }, 'p'], ['título 81', { ...publication, titulo: '😀'.repeat(81) }, 'p'],
 ['nombre 201', { ...profile, nombre_publico: '😀'.repeat(201) }, 'u'],
 ['nombre vacío', { ...profile, nombre_publico: '' }, 'u'],
 ['precio negativo', { ...publication, precio_mxn: -1 }, 'p'],
 ['precio máximo', { ...publication, precio_mxn: 100001 }, 'p'],
 ['precio decimal', { ...publication, precio_mxn: 1.5 }, 'p'],
 ['precio string', { ...publication, precio_mxn: '1200' }, 'p'],
 ['array', [], 'p'], ['null', null, 'p'], ['no disponible extra', { v: 1, disponible: false, tipo: 'perfil' }, 'u'],
 ['surrogate inválido', { ...publication, titulo: '\ud800' }, 'p']
]) test('contrato rechazado: ' + label, () => assert.equal(validatePreview(value, tipo), null));
test('Unicode cuenta puntos de código y acepta límites exactos', () => {
 assert(validatePreview({ ...publication, titulo: '😀'.repeat(80), precio_mxn: 0 }, 'p'));
 assert(validatePreview({ ...profile, nombre_publico: '😀'.repeat(200) }, 'u'));
 assert(validatePreview({ ...publication, precio_mxn: 100000 }, 'p'));
});
for (const path of ['/p/', '/p/' + token + '/', '/p/' + token + '/extra', '/p/' + 'A'.repeat(21),
 '/p/' + 'A'.repeat(23), '/p/' + 'A'.repeat(21) + '=', '/p/%41' + 'A'.repeat(21), '/p//'+token])
 test('ruta inválida sin normalización: ' + path.length + ':' + path.slice(0,8), () => assert.equal(shareRoute(path), null));
test('rutas ajenas no pertenecen al Worker', () => {
 for (const p of ['/', '/privacidad', '/perfil', '/publicaciones']) assert.equal(isSharePath(p), false);
 assert.equal(isSharePath('/%70/'+token), true);
 assert.deepEqual(shareRoute('/u/'+token), { tipo: 'u', token });
});
test('activación deshabilitada por defecto y exacta', () => {
 assert.equal(readConfig({}).state, 'disabled');
 assert.equal(readConfig({ ...env, SHARE_LINKS_ENABLED: 'false' }).state, 'disabled');
 assert.equal(readConfig(env).state, 'active');
});
for (const [name, value] of [
 ['SHARE_LINKS_ENABLED','TRUE'], ['SHARE_LINKS_ENV','production'], ['SHARE_LINKS_ENV','preview'],
 ['SHARE_PREVIEW_URL',undefined], ['SHARE_PREVIEW_URL','http://localhost:8902/functions/v1/share-preview'],
 ['SHARE_PREVIEW_URL',cfg.endpoint+'?token=x'], ['SHARE_PREVIEW_URL',cfg.endpoint+'/'],
 ['SHARE_PREVIEW_URL','http://user:pass@127.0.0.1:8902/functions/v1/share-preview'],
 ['SHARE_PREVIEW_URL','https://example.invalid/functions/v1/share-preview'],
 ['SHARE_LINKS_PUBLIC_ORIGIN','http://127.0.0.1:8901/'], ['SHARE_LINKS_PUBLIC_ORIGIN',undefined],
 ['SHARE_PREVIEW_KEY_CURRENT','short'], ['SHARE_PREVIEW_KEY_CURRENT','x'.repeat(31)+'\n']
]) test('configuración rechazada: ' + name + ':' + String(value).length, () => assert.equal(readConfig({ ...env, [name]: value }).state, 'invalid'));
test('petición upstream exacta, sin privilegios nuevos', async () => {
 let calls=0;
 const got=await loadPreview(cfg,'p',token,async (url,init) => {
  calls++; assert.equal(url,cfg.endpoint); assert.equal(init.method,'POST'); assert.equal(init.redirect,'manual');
  assert.deepEqual(init.headers, { 'Content-Type':'application/json','X-RLVO-Preview-Key':cfg.key });
  assert.equal(init.body,JSON.stringify({v:1,tipo:'p',token}));
  return Response.json(publication);
 });
 assert.deepEqual(got,publication); assert.equal(calls,1);
});
for (const status of [400,401,405,413,429,500,502,503,504,301,302,307,308])
 test('error/redirect upstream no se expone: '+status, async () => assert.equal(await loadPreview(cfg,'p',token,async()=>new Response('INTERNAL',{status})),null));
for (const [name,response] of [
 ['JSON roto',()=>new Response('{',{headers:{'content-type':'application/json'}})],
 ['Content-Type',()=>new Response(JSON.stringify(publication),{headers:{'content-type':'text/html'}})],
 ['UTF-8',()=>new Response(new Uint8Array([0xc3,0x28]),{headers:{'content-type':'application/json'}})],
 ['excesivo',()=>new Response(' '.repeat(MAX_RESPONSE_BYTES+1),{headers:{'content-type':'application/json'}})],
 ['declarado excesivo',()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'99999'}})],
 ['truncado',()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'10'}})],
 ['lectura falla',()=>new Response(new ReadableStream({start(c){c.error(Error('INTERNAL'));}}),{headers:{'content-type':'application/json'}})]
]) test('respuesta inválida: '+name,async()=>assert.equal(await loadPreview(cfg,'p',token,async()=>response()),null));
test('error de red es genérico y sin reintento',async()=>{
 let calls=0; assert.equal(await loadPreview(cfg,'p',token,async()=>{calls++;throw Error('INTERNAL');}),null); assert.equal(calls,1);
});
test('deadline aborta fetch aunque el proveedor no resuelva',async()=>{
 let signal; const start=Date.now();
 assert.equal(await loadPreview(cfg,'p',token,async(_u,i)=>{signal=i.signal;return new Promise(()=>{});},30),null);
 assert(signal.aborted);assert(Date.now()-start<1000);
});
test('deadline incluye cuerpo, cancela stream y aborta señal',async()=>{
 let cancelled=false,signal;
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}});
 assert.equal(await loadPreview(cfg,'p',token,async(_u,i)=>{signal=i.signal;return new Response(body,{headers:{'content-type':'application/json'}});},30),null);
 assert(cancelled);assert(signal.aborted);
});
test('precio MXN',()=>assert.equal(priceMxn(1200),'$1,200 MXN'));
test('deploy habitual no tiene entrada ni bindings W1; opt-in apagado',()=>{
 const normal=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 assert.equal(normal.main,undefined);assert.equal(normal.assets.binding,undefined);
 const opt=readFileSync('wrangler.share-links.jsonc','utf8');
 assert(opt.includes('"SHARE_LINKS_ENABLED": "false"'));assert(!opt.includes('supabase.co'));
});
