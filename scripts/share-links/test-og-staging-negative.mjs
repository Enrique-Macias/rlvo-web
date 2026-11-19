import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const cases=[
 ['allowlist','session.tokens.has(route.token)','true','STAGING allowlist denies'],
 ['expiry','time < session.end','true','STAGING bounded manifest'],
 ['source pin','env.SHARE_OG_SOURCE_URL !== ep.source','false','STAGING pins endpoint'],
 ['project binding','preview.endpoint !== ep.preview','false','STAGING private configuration'],
];
for(const[label,from,to,pattern]of cases){const root=mkdtempSync(join(tmpdir(),'rlvo-og-staging-negative-'));try{
 cpSync('worker',join(root,'worker'),{recursive:true});cpSync('src/config',join(root,'src/config'),{recursive:true});
 const run=()=>spawnSync(process.execPath,['--experimental-strip-types','--test',`--test-name-pattern=${pattern}`,'tests/share-links/og-staging.test.mjs'],{env:{...process.env,OG_STAGING_MODULE_ROOT:root},encoding:'utf8',timeout:30000});
 const base=run();assert.equal(base.status,0,`${label}: positive control failed`);
 const file=join(root,'worker/og-staging-policy.ts'),s=readFileSync(file,'utf8');assert.equal(s.split(from).length,2);writeFileSync(file,s.replace(from,to));
 const bad=run();assert.equal(bad.signal,null);assert.notEqual(bad.status,0);assert(/AssertionError|ERR_ASSERTION/.test(bad.stdout),`${label}: failed for another cause`);console.log(`DETECTED: ${label}`);
 }finally{rmSync(root,{recursive:true,force:true});}}
console.log(`${cases.length}/${cases.length} STAGING negative controls detected; source files preserved.`);
