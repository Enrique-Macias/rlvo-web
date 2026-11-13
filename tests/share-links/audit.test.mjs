import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/audit-static.mjs');
function run(mutate){
 mkdirSync('.wrangler',{recursive:true});
 const root=mkdtempSync(resolve('.wrangler/audit-fixture-'));
 try{
  cpSync('dist',join(root,'dist'),{recursive:true});
  mutate?.(path=>join(root,'dist',path));
  return spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,SITE_ENV:'production'}});
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('auditoría real conserva reglas generales y permite solo la plantilla sin scripts',()=>{
 const r=run();assert.equal(r.status,0,r.stderr);
});
test('control negativo: script añadido a plantilla es rechazado por auditoría real',()=>{
 const r=run(path=>{const p=path('compartir/plantilla.html');writeFileSync(p,readFileSync(p,'utf8').replace('</body>','<script>fixture</script></body>'));});
 assert.equal(r.status,1);assert(r.stderr.includes('La única plantilla Share Links'));
});
test('control negativo: landing sin beacon sigue siendo rechazada',()=>{
 const r=run(path=>{const p=path('index.html');writeFileSync(p,readFileSync(p,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));});
 assert.equal(r.status,1);assert(r.stderr.includes('Se requiere exactamente el script oficial'));
});
