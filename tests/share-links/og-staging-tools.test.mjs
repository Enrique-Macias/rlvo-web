import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,cpSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{allowedSecretRequest}=require('../../scripts/share-links/og-secret-transport.cjs');
const account='1'.repeat(32),hash=createHash('sha256').update(account).digest('hex'),config={name:'rlvo-share-links-staging',account_id:account};
const base='/client/v4/accounts/'+account+'/workers/scripts/rlvo-share-links-staging';
test('secret transport prevents Worker creation, deployment, DNS, Access and other secrets routes',()=>{
 const api='https://api.cloudflare.com';
 assert(allowedSecretRequest(config,api,'PUT',base+'/secrets',hash));
 for(const [method,path]of [['PUT',base],['POST',base+'/versions'],['PUT',base+'/subdomain'],['DELETE',base+'/secrets/SHARE_OG_KEY_CURRENT'],['PUT',base.replace('staging','production')+'/secrets'],['POST','/client/v4/accounts/'+account+'/access/apps'],['PATCH','/client/v4/zones/a/dns_records/b']])assert.equal(allowedSecretRequest(config,api,method,path,hash),false);
 assert.equal(allowedSecretRequest({...config,name:'production'},api,'PUT',base+'/secrets',hash),false);
 assert.equal(allowedSecretRequest(config,api,'PUT',base+'/secrets'),false,'synthetic account is never the real account');
 assert.equal(allowedSecretRequest(config,'https://evil.invalid','PUT',base+'/secrets',hash),false);
});
test('secret helper without owner switch never opens the private key file or starts Wrangler',()=>{
 const p=spawnSync('python3',['scripts/share-links/set-og-staging-secret.py'],{encoding:'utf8'});assert.equal(p.status,1);assert(p.stderr.includes('Not executed'));assert(!p.stdout.includes('SHARE_OG_KEY_CURRENT='));
});
const PROJECT='abcdefghij0123456789',PREVIEW='https://'+PROJECT+'.supabase.co/functions/v1/share-preview',SOURCE='https://'+PROJECT+'.supabase.co/functions/v1/share-og-source';
const PIN=createHash('sha256').update(PREVIEW).digest('hex');
const live=(over={})=>({v:1,projectRef:PROJECT,tokens:['A'.repeat(22)],startsAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),...over});
const sandbox=()=>{const root=mkdtempSync(join(tmpdir(),'rlvo-og-session-tools-'));cpSync('wrangler.share-links.og.staging.jsonc',join(root,'wrangler.share-links.og.staging.jsonc'));mkdirSync(join(root,'worker'));return root;};
const script=resolve('scripts/share-links/prepare-og-staging.mjs');
test('session generator CLI requires attestation and the compiled STAGING pin; fails closed without a session',()=>{
 const root=sandbox();
 try{
  const file=join(root,'fixture.json'),run=()=>spawnSync(process.execPath,['--experimental-strip-types',script,file,account,'true'],{cwd:root,encoding:'utf8'});
  writeFileSync(file,JSON.stringify({manifest:live()}));assert.notEqual(run().status,0);assert(!existsSync(join(root,'.wrangler/og-staging-session')));
  // Fictitious project never matches the compiled V1 pin: the CLI cannot be pointed at another project.
  writeFileSync(file,JSON.stringify({syntheticOnly:true,fixtureVerified:true,manifest:live()}));const p=run();assert.notEqual(p.status,0);assert(p.stderr.includes('not the pinned STAGING project'));assert(!existsSync(join(root,'.wrangler/og-staging-session')));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('session generator derives private endpoints, writes only ignored files and rejects invalid manifests',async()=>{
 const {prepareOgStagingSession}=await import(pathToFileURL(script).href);
 const handoff=m=>({syntheticOnly:true,fixtureVerified:true,manifest:m});
 for(const bad of [live({projectRef:''}),live({projectRef:'ABCDEFGHIJ0123456789'}),live({projectRef:PROJECT+'.evil.example'}),live({startsAt:new Date(Date.now()-7200000).toISOString(),expiresAt:new Date(Date.now()-3600000).toISOString()}),live({expiresAt:new Date(Date.now()+7200000).toISOString()}),live({tokens:[]}),live({tokens:['A'.repeat(22),'A'.repeat(22)]}),{...live(),extra:1}]){
  const root=sandbox();try{assert.throws(()=>prepareOgStagingSession(handoff(bad),account,'true',{cwd:root,endpointPin:PIN}));assert(!existsSync(join(root,'.wrangler/og-staging-session')));}finally{rmSync(root,{recursive:true,force:true});}
 }
 const root=sandbox();
 try{
  for(const pin of [undefined,'0'.repeat(64),'x'])assert.throws(()=>prepareOgStagingSession(handoff(live()),account,'true',{cwd:root,...(pin===undefined?{}:{endpointPin:pin})}),/pinned STAGING project/);
  assert.throws(()=>prepareOgStagingSession(handoff(live()),'x','true',{cwd:root,endpointPin:PIN}));assert.throws(()=>prepareOgStagingSession(handoff(live()),account,'maybe',{cwd:root,endpointPin:PIN}));
  prepareOgStagingSession(handoff(live()),account,'true',{cwd:root,endpointPin:PIN});
  const active=JSON.parse(readFileSync(join(root,'.wrangler/og-staging-session/active.json'))),off=JSON.parse(readFileSync(join(root,'.wrangler/og-staging-session/off.json')));
  assert.equal(active.name,'rlvo-share-links-staging');assert.equal(active.vars.SHARE_OG_ENABLED,'true');assert.equal(off.vars.SHARE_OG_ENABLED,'false');assert.equal(active.preview_urls,false);assert.equal(active.images.remote,false);
  for(const c of [active,off]){assert.equal(c.vars.SHARE_PREVIEW_URL,PREVIEW);assert.equal(c.vars.SHARE_OG_SOURCE_URL,SOURCE);assert(!('SHARE_OG_KEY_CURRENT' in c.vars));assert(!('SHARE_PREVIEW_KEY_CURRENT' in c.vars));}
  assert(readFileSync(join(root,'.wrangler/og-staging-session/entry.ts'),'utf8').includes(PROJECT));
  assert.throws(()=>prepareOgStagingSession(handoff(live()),account,'true',{cwd:root,endpointPin:PIN}),/Preserve previous session/,'existing session must never be overwritten');
  const versioned=JSON.parse(readFileSync(join(root,'wrangler.share-links.og.staging.jsonc'),'utf8').replace(/^\s*\/\/.*$/gm,''));assert.equal(versioned.vars.SHARE_PREVIEW_URL,'');assert.equal(versioned.vars.SHARE_OG_SOURCE_URL,'');
 }finally{rmSync(root,{recursive:true,force:true});}
});
