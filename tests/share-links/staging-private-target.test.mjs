import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, symlinkSync, linkSync, lstatSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { EXPECTED as CLOSED, validateStagingTarget } from '../../scripts/share-links/check-staging-target.mjs';
import { createPrivateControls, validateStagingPrivateTarget, validatePrivateTemplate, rejectPrivateOverrides, TEMPLATE_PATH, CONFIG_PATH, ACCOUNT_FINGERPRINT } from '../../scripts/share-links/check-staging-private-target.mjs';
import { endpointInput } from '../../scripts/share-links/prepare-staging-private-config.mjs';
import { STAGING_ENDPOINT_SHA256 } from '../../worker/staging-policy.ts';

// Synthetic endpoint only; no credentials, DNS, fetch or hosted Access fixtures.
const endpoint = 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/share-preview';
const pin = createHash('sha256').update(endpoint).digest('hex');
const controls = createPrivateControls(pin);
const env = {};
const valid = () => {
 const c = structuredClone(CLOSED); c.workers_dev = true; c.main = '../../worker/staging.ts';
 c.assets.directory = '../share-links-staging-assets'; c.vars.SHARE_LINKS_ENABLED = 'true';
 c.vars.SHARE_PREVIEW_URL = endpoint; return c;
};
const temp = async fn => {
 mkdirSync('.wrangler', {recursive:true}); const root = mkdtempSync(resolve('.wrangler/s1-private-test-'));
 try {
  cpSync(TEMPLATE_PATH, join(root,TEMPLATE_PATH)); mkdirSync(join(root,'worker'));
  writeFileSync(join(root,'worker/staging.ts'),'// synthetic entry; never executed\n');
  mkdirSync(join(root,'.wrangler')); cpSync('.wrangler/share-links-staging-assets',join(root,'.wrangler/share-links-staging-assets'),{recursive:true});
  return await fn(root);
 } finally { rmSync(root,{recursive:true,force:true}); }
};
const encode = x => JSON.stringify(x,null,2)+'\n';
test('S1: synthetic private target exact and closed original guard remain distinct',async()=>{
 validatePrivateTemplate(JSON.parse(readFileSync(TEMPLATE_PATH,'utf8')));
 assert.equal(await controls.validate(valid(),{targetEnv:env}),true);
 assert.equal(validateStagingTarget(CLOSED,{targetEnv:env}),true);
 assert.throws(()=>validateStagingTarget(valid(),{targetEnv:env}));
 await assert.rejects(controls.validate(CLOSED,{targetEnv:env}));
 assert.equal(ACCOUNT_FINGERPRINT,'36da4df1ff8cc468');
});
test('S1: compiled CLI pin cannot be selected by synthetic config or environment',async()=>{
 assert.notEqual(pin,STAGING_ENDPOINT_SHA256);
 await assert.rejects(validateStagingPrivateTarget(valid(),{targetEnv:env}));
 await assert.rejects(createPrivateControls('0'.repeat(64)).validate(valid(),{targetEnv:env}));
 const c=valid();c.vars.STAGING_ENDPOINT_SHA256=pin;await assert.rejects(controls.validate(c,{targetEnv:env}));
});
for(const [name,mutate] of [
 ['production name',c=>c.name='rlvo-public-web'],['other name',c=>c.name='synthetic-worker'],
 ['local entry',c=>c.main='../../worker/index.ts'],['alternate entry',c=>c.main='../../worker/handler.ts'],
 ['runtime date',c=>c.compatibility_date='2026-01-01'],['runtime flags',c=>c.compatibility_flags=['nodejs_compat']],
 ['disabled',c=>c.vars.SHARE_LINKS_ENABLED='false'],['boolean enable',c=>c.vars.SHARE_LINKS_ENABLED=true],
 ['ambiguous enable',c=>c.vars.SHARE_LINKS_ENABLED=' true'],['unknown env',c=>c.vars.SHARE_LINKS_ENV='prod'],
 ['local env',c=>c.vars.SHARE_LINKS_ENV='local'],['production origin',c=>c.vars.SHARE_LINKS_PUBLIC_ORIGIN='https://www.rlvo.com.mx'],
 ['alternate origin',c=>c.vars.SHARE_LINKS_PUBLIC_ORIGIN='https://fixture.invalid'],['missing origin',c=>delete c.vars.SHARE_LINKS_PUBLIC_ORIGIN],
 ['previews',c=>c.preview_urls=true],['workers_dev off',c=>c.workers_dev=false],['observability',c=>c.observability.enabled=true],
 ['logpush',c=>c.logpush=true],['routes',c=>c.routes=['www.rlvo.com.mx/*']],
 ['custom domains',c=>c.routes=[{pattern:'fixture.invalid',custom_domain:true}]],['even empty routes',c=>c.routes=[]],
 ['cron',c=>c.triggers={crons:['* * * * *']}],['service',c=>c.services=[{binding:'UPSTREAM',service:'fixture'}]],
 ['extra binding',c=>c.kv_namespaces=[{binding:'OTHER',id:'synthetic'}]],['env override',c=>c.env={production:{name:'rlvo-public-web'}}],
 ['account selector',c=>c.account_id='synthetic-account'],['zone selector',c=>c.zone_id='synthetic-zone'],
 ['build hook',c=>c.build={command:'synthetic'}],['assets landing',c=>c.assets.directory='../../dist'],
 ['asset binding',c=>c.assets.binding='OTHER'],['asset Worker-first',c=>c.assets.run_worker_first=false],
 ['asset partial Worker-first',c=>c.assets.run_worker_first=['/p/*']],['asset HTML',c=>c.assets.html_handling='auto-trailing-slash'],
 ['secret literal',c=>c.vars.SHARE_PREVIEW_KEY_CURRENT='synthetic-not-a-real-key'],
 ['service role',c=>c.vars.service_role='synthetic'],['apikey',c=>c.vars.apikey='synthetic'],
 ['secret store',c=>c.secrets_store_secrets=[{binding:'SECRET'}]],['arbitrary var',c=>c.vars.OTHER='synthetic'],
 ['missing vars',c=>delete c.vars],['template endpoint',c=>c.vars.SHARE_PREVIEW_URL='__PINNED_STAGING_ENDPOINT_FROM_STDIN__']
])test('S1: reject configuration '+name,async()=>{const c=valid();mutate(c);await assert.rejects(controls.validate(c,{targetEnv:env}));});
for(const [name,value] of [
 ['empty',''],['alternate project',endpoint.replace('abcdefghijklmnopqrst','tsrqponmlkjihgfedcba')],
 ['production domain','https://www.rlvo.com.mx/functions/v1/share-preview'],['http',endpoint.replace('https:','http:')],
 ['port443',endpoint.replace('.co/','.co:443/')],['other port',endpoint.replace('.co/','.co:444/')],
 ['credentials',endpoint.replace('https://','https://fixture:fixture@')],['query',endpoint+'?fixture=1'],['empty query',endpoint+'?'],
 ['fragment',endpoint+'#fixture'],['empty fragment',endpoint+'#'],['leading space',' '+endpoint],['trailing space',endpoint+' '],
 ['tab','\t'+endpoint],['newline',endpoint+'\n'],['uppercase host',endpoint.replace('abcdefghijklmnopqrst','ABCDEFGHIJKLMNOPQRST')],
 ['trailing dot',endpoint.replace('.co/','.co./')],['wrong route',endpoint+'/more'],['encoded path',endpoint.replace('/functions','/%66unctions')],
 ['dot segment',endpoint.replace('/functions','/./functions')],['protocol relative',endpoint.replace('https:','')],
 ['backslash',endpoint.replace('https://','https:\\')],['redirect destination','https://redirect.invalid/functions/v1/share-preview']
])test('S1: reject endpoint '+name,async()=>{const c=valid();c.vars.SHARE_PREVIEW_URL=value;await assert.rejects(controls.validate(c,{targetEnv:env}));});
for(const path of ['wrangler.jsonc','wrangler.share-links.jsonc','wrangler.share-links.staging.jsonc',TEMPLATE_PATH,'./'+CONFIG_PATH,'/tmp/wrangler.jsonc'])
 test('S1: reject path '+path,async()=>assert.rejects(controls.validate(valid(),{configPath:path,targetEnv:env})));
for(const arg of ['--name','--env','--config','--var','--route','--keep-vars','--account-id'])
 test('S1: reject argument '+arg,async()=>assert.rejects(controls.validate(valid(),{args:[arg],targetEnv:env})));
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_ENV','WRANGLER_ENV','WRANGLER_CONFIG','WRANGLER_CONFIG_PATH','WRANGLER_NAME','WRANGLER_CWD','WRANGLER_BUILD_PLATFORM','WRANGLER_LOG','SHARE_LINKS_ENABLED','SHARE_PREVIEW_URL','SHARE_PREVIEW_KEY_CURRENT'])
 test('S1: reject selector '+key,async()=>assert.rejects(controls.validate(valid(),{targetEnv:{[key]:'synthetic'}})));
test('S1: telemetry opt-outs are harmless; other telemetry values are rejected',()=>{
 rejectPrivateOverrides([],{WRANGLER_SEND_METRICS:'false',WRANGLER_SEND_ERROR_REPORTS:'false'});
 assert.throws(()=>rejectPrivateOverrides([],{WRANGLER_SEND_METRICS:'true'}));
});
test('S1: private configuration deterministic, ignored, no hosted assertions',()=>temp(async root=>{
 const a=await controls.prepare({endpoint},{root,targetEnv:env});const first=readFileSync(join(root,CONFIG_PATH));
 const b=await controls.prepare({endpoint},{root,targetEnv:env});assert.deepEqual(readFileSync(join(root,CONFIG_PATH)),first);assert.deepEqual(a,b);
 assert.equal(a.scope,'LOCAL_ONLY');assert.equal(a.hostedPreflight,'REQUIRED_NOT_PERFORMED');assert.equal(a.deploymentAuthorized,false);
 assert(!first.includes('SHARE_PREVIEW_KEY_CURRENT'));assert.equal(await controls.check([],{root,targetEnv:env}).then(x=>x.guard),'PASS');
 const ignored=spawnSync('git',['check-ignore','--quiet',CONFIG_PATH],{cwd:process.cwd()});assert.equal(ignored.status,0);
}));
for(const [name,mutate] of [
 ['template extra',r=>{const p=join(r,TEMPLATE_PATH),c=JSON.parse(readFileSync(p));c.env={};writeFileSync(p,encode(c));}],
 ['asset bytes',r=>writeFileSync(join(r,'.wrangler/share-links-staging-assets/favicon.svg'),'synthetic')],
 ['asset extra',r=>writeFileSync(join(r,'.wrangler/share-links-staging-assets/extra.txt'),'synthetic')],
 ['asset missing',r=>rmSync(join(r,'.wrangler/share-links-staging-assets/og/rlvo-paleta-06.png'))],
 ['asset symlink',r=>{const p=join(r,'.wrangler/share-links-staging-assets/favicon.svg');rmSync(p);symlinkSync(resolve('public/favicon.svg'),p);}],
 ['template symlink',r=>{const p=join(r,TEMPLATE_PATH);rmSync(p);symlinkSync(resolve(TEMPLATE_PATH),p);}],
 ['parent symlink',r=>symlinkSync(resolve('.wrangler'),join(r,dirname(CONFIG_PATH)))],
 ['dotenv',r=>writeFileSync(join(r,'.env'),'SYNTHETIC=fixture')],
 ['dotenv local',r=>writeFileSync(join(r,'.env.local'),'SYNTHETIC=fixture')],
 ['dev vars',r=>writeFileSync(join(r,'.dev.vars'),'SYNTHETIC=fixture')],
 ['deployment redirect',r=>{mkdirSync(join(r,'.wrangler/deploy'));writeFileSync(join(r,'.wrangler/deploy/config.json'),'{}');}]
])test('S1: prepare rejects '+name+' without accepted output',()=>temp(async root=>{
 mutate(root);await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));
 assert(!existsSync(join(root,CONFIG_PATH)));
}));
for(const [name,mutate] of [
 ['duplicate keys',s=>s.replace('"workers_dev": true','"workers_dev": false, "workers_dev": true')],
 ['extra keys',s=>s.replace('"preview_urls": false','"preview_urls": false, "routes": []')],
 ['truncated',s=>s.slice(0,-5)],['noncanonical',s=>JSON.stringify(JSON.parse(s))]
])test('S1: final guard re-reads and rejects '+name,()=>temp(async root=>{
 await controls.prepare({endpoint},{root,targetEnv:env});const p=join(root,CONFIG_PATH);writeFileSync(p,mutate(readFileSync(p,'utf8')));
 await assert.rejects(controls.check([],{root,targetEnv:env}));
}));
test('S1: final guard rejects output symlink and materializer does not follow it',()=>temp(async root=>{
 await controls.prepare({endpoint},{root,targetEnv:env});const p=join(root,CONFIG_PATH);rmSync(p);symlinkSync(resolve(TEMPLATE_PATH),p);
 await assert.rejects(controls.check([],{root,targetEnv:env}));await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));
}));
test('S1: guard rejects config-directory dotenv and drift in already prepared assets',()=>temp(async root=>{
 await controls.prepare({endpoint},{root,targetEnv:env});const p=join(root,dirname(CONFIG_PATH),'.env');writeFileSync(p,'SYNTHETIC=fixture');
 await assert.rejects(controls.check([],{root,targetEnv:env}));rmSync(p);
 writeFileSync(join(root,'.wrangler/share-links-staging-assets/favicon.svg'),'synthetic');await assert.rejects(controls.check([],{root,targetEnv:env}));
}));
test('S1: input is bounded fatal UTF-8 JSON data, never shell',async()=>{
 assert.deepEqual(await endpointInput(Readable.from([Buffer.from(JSON.stringify({endpoint}))])),{endpoint});
 await assert.rejects(endpointInput(Readable.from([Buffer.alloc(2049)])));
 await assert.rejects(endpointInput(Readable.from([Buffer.from([0xff])])));
 await assert.rejects(endpointInput(Readable.from(['$(synthetic-command)'])));
});
for(const input of [null,[],{endpoint,secret:'synthetic'}, {url:endpoint}, {endpoint:'synthetic'}])
 test('S1: materializer rejects input schema '+JSON.stringify(input),()=>temp(root=>assert.rejects(controls.prepare(input,{root,targetEnv:env}))));
test('S1: real CLI is sealed and does not echo inputs or accept a test pin',()=>{
 const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^(?:CF_|CLOUDFLARE_|WRANGLER_|SHARE_LINKS_|SHARE_PREVIEW_)/.test(k)));
 const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/share-links/prepare-staging-private-config.mjs'],{input:JSON.stringify({endpoint}),env:cleanEnv,encoding:'utf8'});
 assert.equal(r.status,1);assert(!r.stdout.includes(endpoint));assert(!r.stderr.includes(endpoint));assert.match(r.stderr,/PRIVATE_CONFIG_REJECTED/);
});

test('S1: dangling output symlink cannot create a file outside the package',()=>temp(async root=>{
 const outside=join(root,'never-created.json');mkdirSync(join(root,dirname(CONFIG_PATH)));
 symlinkSync(outside,join(root,CONFIG_PATH));
 await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));assert.equal(existsSync(outside),false);
}));
test('S1: dangling parent symlink is rejected',()=>temp(async root=>{
 symlinkSync(join(root,'absent-directory'),join(root,dirname(CONFIG_PATH)));
 await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));assert.equal(existsSync(join(root,'absent-directory')),false);
}));
test('S1: pre-existing hardlink cannot overwrite another file',()=>temp(async root=>{
 const outside=join(root,'outside.json');writeFileSync(outside,'unchanged');mkdirSync(join(root,dirname(CONFIG_PATH)));
 linkSync(outside,join(root,CONFIG_PATH));await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));assert.equal(readFileSync(outside,'utf8'),'unchanged');
}));
test('S1: absent entry is rejected before config creation and output mode is restrictive',()=>temp(async root=>{
 const p=join(root,'worker/staging.ts');rmSync(p);await assert.rejects(controls.prepare({endpoint},{root,targetEnv:env}));assert(!existsSync(join(root,CONFIG_PATH)));
 writeFileSync(p,'// synthetic');await controls.prepare({endpoint},{root,targetEnv:env});assert.equal(lstatSync(join(root,CONFIG_PATH)).mode & 0o777,0o600);
}));

test('S1: pinned Wrangler reads nested generated config without auth or network',()=>temp(async root=>{
 await controls.prepare({endpoint},{root,targetEnv:env});
 const script=`import assert from 'node:assert/strict';import {resolve,dirname} from 'node:path';import undici from 'undici';\n`+
  `undici.setGlobalDispatcher({dispatch(){throw Error('NETWORK_FORBIDDEN')},close:async()=>{},destroy:async()=>{}});\n`+
  `const {unstable_readConfig}=await import('wrangler');const c=unstable_readConfig({config:process.argv[1]});\n`+
  `assert.equal(c.name,'rlvo-share-links-staging');assert.equal(resolve(c.main),process.argv[2]);\n`+
  `assert.equal(resolve(dirname(c.configPath),c.assets.directory),process.argv[3]);\n`+
  `assert.equal(c.workers_dev,true);assert.equal(c.preview_urls,false);assert.equal(c.assets.run_worker_first,true);console.log('NORMALIZED_LOCAL_ONLY');`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script,join(root,CONFIG_PATH),join(root,'worker/staging.ts'),join(root,'.wrangler/share-links-staging-assets')],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_SEND_ERROR_REPORTS:'false'}});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/NORMALIZED_LOCAL_ONLY/);assert(!r.stdout.includes(endpoint));
}));
