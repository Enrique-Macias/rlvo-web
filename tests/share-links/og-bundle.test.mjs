import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

test('normal and staging bundles contain no local entry, fixtures, secrets or machine paths',async()=>{
 for(const entry of ['worker/index.ts','worker/staging.ts']){
  const result=await build({entryPoints:[entry],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
  const inputs=Object.keys(result.metafile.inputs);
  assert(!inputs.includes('worker/og-local.ts'));
  assert(!inputs.some(p=>/^(tests|scripts)\//.test(p)));
  const code=result.outputFiles[0].text;
  for(const forbidden of ['synthetic-og-key','PRIVATE_INTERNAL_CODEC_FAILURE','/Users/','/private/tmp/','node:','sharp','ogLocalTesting: true'])
   assert(!code.includes(forbidden),entry+': '+forbidden);
  assert(!/\bcaches\s*\.|CacheStorage|\bKV\s*\./.test(code));
 }
});
test('only the separate local configuration selects the OG test entry and its binding is offline',()=>{
 const local=readFileSync('wrangler.share-links.og.local.jsonc','utf8');
 assert(local.includes('"main": "worker/og-local.ts"'));
 assert(local.includes('"remote": false'));assert(local.includes('"SHARE_OG_ENABLED": "false"'));
 for(const file of ['wrangler.jsonc','wrangler.share-links.jsonc','wrangler.share-links.staging.jsonc']){
  const code=readFileSync(file,'utf8');assert(!code.includes('og-local'));assert(!code.includes('"images"'));
 }
});
