import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const mutations=[
 ['revision','og-source.ts',"response.headers.get('x-rlvo-og-rev') !== rev","false",'OG invalid response wrong revision'],
 ['binary cap','og-source.ts','if (total > max)','if (false)','effective binary read cap'],
 ['private header leak','og-handler.ts',"h.delete('Content-Type');","h.delete('Content-Type'); h.set('X-RLVO-Og-Key', 'LEAK');",'public handler 200 image'],
 ['503 to fallback','og-handler.ts',"if (result.kind === 'none') {","if (result.kind === 'none' || result.kind === 'temporary') {",'public handler status 503'],
 ['ambiguous route','og-config.ts','if (!raw || /[%\\\\;]/.test(raw[1]!)) return null;','if (!raw) return { token: "A".repeat(22), rev: "a".repeat(32) };','OG rejects raw ambiguous path'],
 ['module-only activation','og-config.ts',"if (!localTesting) return { state: 'disabled' };","if (false) return { state: 'disabled' };",'normal entry opt-in cannot'],
 ['local URL guard','og-config.ts','new URL(request.url).origin !== preview.origin','false','local entry rejects public request URL'],
];
const run=(root,pattern)=>spawnSync(process.execPath,['--experimental-strip-types','--test',`--test-name-pattern=${pattern}`,'tests/share-links/og-core.test.mjs'],{cwd:process.cwd(),env:{...process.env,OG_MODULE_ROOT:root},encoding:'utf8',timeout:20000});
for(const[name,file,from,to,pattern]of mutations){
 const root=mkdtempSync(join(tmpdir(),'rlvo-og-negative-'));
 try{
  cpSync('worker',join(root,'worker'),{recursive:true});cpSync('src/config',join(root,'src/config'),{recursive:true});
  const baseline=run(root,pattern);assert.equal(baseline.status,0,`${name}: baseline did not pass\n${baseline.stdout}\n${baseline.stderr}`);
  const target=join(root,'worker',file),original=readFileSync(target,'utf8');assert.equal(original.split(from).length,2,`${name}: mutation target not unique`);
  writeFileSync(target,original.replace(from,to));
  const result=run(root,pattern);assert.equal(result.signal,null,`${name}: process terminated`);assert.notEqual(result.status,0,`${name}: undetected mutation`);
  assert(result.stdout.includes('AssertionError')||result.stdout.includes('ERR_ASSERTION'),`${name}: failed for wrong reason\n${result.stdout}\n${result.stderr}`);
  console.log(`DETECTED: ${name}`);
 }finally{rmSync(root,{recursive:true,force:true});}
}
console.log(`${mutations.length}/${mutations.length} OG negative controls detected on isolated copies; no source mutations.`);
