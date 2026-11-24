// PL-085 Fase 6E — integridad de configuración por entorno (local, STAGING, PROD).
// Solo lee archivos versionados del repositorio. No invoca Wrangler ni servicios remotos.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {readConfig,PREVIEW_PATH} from '../../worker/config.ts';
import {readOgConfig,OG_PATH} from '../../worker/og-config.ts';
import {createStagingPolicy,STAGING_ORIGIN} from '../../worker/staging-policy.ts';
import {stagingFixtureGate,stagingOgConfig,ogStagingEndpoints,stagingSessionProject} from '../../worker/og-staging-policy.ts';
// site.ts importa JSON sin atributos; se lee el dominio fuente como texto (mismo valor que usa el build).
const domain=/const domain = '([a-z0-9.-]+)';/.exec(readFileSync('src/config/site.ts','utf8'))?.[1];
const site={domain,url:'https://www.'+domain};

/** JSONC mínimo: elimina comentarios fuera de cadenas; comas finales siguen siendo error. */
export function parseJsonc(text){
 let out='',inString=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(inString){out+=c;if(c==='\\'){out+=text[++i];}else if(c==='"')inString=false;continue;}
  if(c==='"'){inString=true;out+=c;continue;}
  if(c==='/'&&text[i+1]==='/'){while(i<text.length&&text[i]!=='\n')i++;out+='\n';continue;}
  if(c==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);if(end<0)throw Error('comentario sin cerrar');i=end+1;continue;}
  out+=c;
 }
 return JSON.parse(out);
}
const PROD_NAME='rlvo-public-web',STAGING_NAME='rlvo-share-links-staging',LOCAL_NAME='rlvo-og-local-only';
const RUN_FIRST_PROD=['/p','/p/*','/u','/u/*','/%70','/%70/*','/%75','/%75/*'];
// Inventario cerrado: cualquier configuración nueva exige revisar este test (y su entorno).
const INVENTORY={
 'wrangler.jsonc':{env:'prod',name:PROD_NAME,main:undefined},
 'wrangler.share-links.jsonc':{env:'prod',name:PROD_NAME,main:'worker/index.ts'},
 'wrangler.share-links.og.local.jsonc':{env:'local',name:LOCAL_NAME,main:'worker/og-local.ts'},
 'wrangler.share-links.staging.jsonc':{env:'staging',name:STAGING_NAME,main:'worker/staging.ts'},
 'wrangler.share-links.og.staging.jsonc':{env:'staging',name:STAGING_NAME,main:'worker/og-staging.ts'},
 'wrangler.share-links.staging.private.template.jsonc':{env:'staging-template',name:STAGING_NAME,main:'worker/staging.ts'},
};
const ALLOWED_KEYS=new Set(['name','main','compatibility_date','workers_dev','preview_urls','observability','assets','vars','images']);
const configs=Object.fromEntries(Object.keys(INVENTORY).map(f=>[f,parseJsonc(readFileSync(f,'utf8'))]));
const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];

test('6E config: inventario cerrado de configuraciones Wrangler en la raíz',()=>{
 const present=readdirSync('.').filter(f=>/^wrangler\b/i.test(f)).sort();
 assert.deepEqual(present,Object.keys(INVENTORY).sort());
});
for(const [file,spec] of Object.entries(INVENTORY))test('6E config: '+file+' sin rutas, cuenta, bindings remotos ni secretos',()=>{
 const c=configs[file];
 for(const k of Object.keys(c))assert(ALLOWED_KEYS.has(k),`${file}: clave no admitida ${k} (routes, account_id, env, KV, D1, R2, services, triggers, dev...)`);
 assert.equal(c.name,spec.name);assert.equal(c.main,spec.main);assert.equal(c.compatibility_date,'2026-09-29');
 if(c.preview_urls!==undefined)assert.equal(c.preview_urls,false);
 if(c.main!==undefined){assert.equal(c.preview_urls,false);assert.deepEqual(c.observability,{enabled:false});}
 assert.equal(c.workers_dev??false,spec.env==='staging-template',`${file}: workers_dev solo en la plantilla privada STAGING`);
 for(const [name,value] of Object.entries(c.vars??{})){
  assert.equal(typeof value,'string');assert(!/KEY|SECRET|TOKEN|PASSWORD/i.test(name),`${file}: ${name} debe ser secreto, nunca var`);
 }
 for(const value of strings(c))assert(!/supabase|service_role|\beyJ[A-Za-z0-9_-]{8,}/i.test(value),`${file}: endpoint o credencial versionada`);
 if(c.images!==undefined){assert.deepEqual(c.images,{binding:'IMAGES',remote:false});assert(file.includes('.og.'),file);}
});
test('6E config: PROD estático y opt-in W1 sin OG, Images ni orígenes de otros entornos',()=>{
 const stat=configs['wrangler.jsonc'];
 assert.deepEqual(Object.keys(stat).sort(),['assets','compatibility_date','name']);
 assert.deepEqual(stat.assets,{directory:'./dist',not_found_handling:'404-page',html_handling:'drop-trailing-slash'});
 const w1=configs['wrangler.share-links.jsonc'];
 assert.deepEqual(w1.vars,{SHARE_LINKS_ENABLED:'false',SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:'',SHARE_PREVIEW_URL:''});
 assert.deepEqual(w1.assets.run_worker_first,RUN_FIRST_PROD);assert.equal(w1.assets.directory,'./dist');assert.equal(w1.images,undefined);
 for(const f of ['wrangler.jsonc','wrangler.share-links.jsonc']){
  const text=readFileSync(f,'utf8');
  for(const forbidden of ['SHARE_OG','og-local','og-staging','workers.dev',STAGING_ORIGIN,'127.0.0.1'])assert(!text.includes(forbidden),f+': '+forbidden);
 }
});
test('6E config: STAGING apagado, origen fijo y sin endpoints versionados',()=>{
 for(const f of ['wrangler.share-links.staging.jsonc','wrangler.share-links.og.staging.jsonc']){
  const c=configs[f];
  assert.equal(c.vars.SHARE_LINKS_ENABLED,'false');assert.equal(c.vars.SHARE_LINKS_ENV,'staging');
  assert.equal(c.vars.SHARE_LINKS_PUBLIC_ORIGIN,STAGING_ORIGIN);assert.equal(c.vars.SHARE_PREVIEW_URL,'');
  assert.equal(c.assets.directory,'./.wrangler/share-links-staging-assets');assert.equal(c.assets.run_worker_first,true);assert.equal(c.assets.not_found_handling,'none');
  for(const value of strings(c))assert(!value.includes(site.domain),f+': dominio de producción en STAGING');
 }
 const og=configs['wrangler.share-links.og.staging.jsonc'];
 assert.equal(og.vars.SHARE_OG_ENABLED,'false');assert.equal(og.vars.SHARE_OG_SOURCE_URL,'');
 const tpl=configs['wrangler.share-links.staging.private.template.jsonc'];
 assert.equal(tpl.vars.SHARE_PREVIEW_URL,'__PINNED_STAGING_ENDPOINT_FROM_STDIN__');assert.equal(tpl.vars.SHARE_LINKS_PUBLIC_ORIGIN,STAGING_ORIGIN);
 assert.equal(Object.keys(tpl.vars).some(k=>k.startsWith('SHARE_OG')),false,'la plantilla V1 no habilita OG');
});
test('6E config: entrada local OG apagada y solo loopback',()=>{
 const c=configs['wrangler.share-links.og.local.jsonc'];
 assert.deepEqual(c.vars,{SHARE_LINKS_ENABLED:'false',SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:'',SHARE_PREVIEW_URL:'',SHARE_OG_ENABLED:'false',SHARE_OG_SOURCE_URL:''});
});
test('6E config: el manifiesto STAGING versionado está vacío y cierra todo',()=>{
 const manifest=JSON.parse(readFileSync('worker/og-staging-fixtures.json','utf8'));
 assert.deepEqual(manifest,{v:1,projectRef:'',tokens:[],startsAt:'',expiresAt:''});
 assert.equal(stagingSessionProject(manifest),null);
 assert.equal(stagingFixtureGate(manifest,()=>Date.now())(new Request(STAGING_ORIGIN+'/p/'+'A'.repeat(22))),false);
});
test('6E config: .gitignore excluye material privado de sesión y variables locales',()=>{
 const lines=readFileSync('.gitignore','utf8').split('\n').map(l=>l.trim());
 for(const entry of ['.wrangler/','.dev.vars','.env','.env.*','/qa/'])assert(lines.includes(entry),entry);
});

// Separación cruzada: la configuración completa de un entorno nunca activa la política de otro.
const token='A'.repeat(22),previewKey='synthetic-preview-key-'.repeat(2),ogKey='synthetic-og-key-'.repeat(3);
const PROJECT='abcdefghij0123456789',EP=ogStagingEndpoints(PROJECT);
const stagingPolicy=createStagingPolicy(createHash('sha256').update(EP.preview).digest('hex'));
const localEnv={SHARE_LINKS_ENABLED:'true',SHARE_LINKS_ENV:'local',SHARE_LINKS_PUBLIC_ORIGIN:'http://127.0.0.1:8901',
 SHARE_PREVIEW_URL:'http://127.0.0.1:8902'+PREVIEW_PATH,SHARE_PREVIEW_KEY_CURRENT:previewKey,
 SHARE_OG_ENABLED:'true',SHARE_OG_SOURCE_URL:'http://127.0.0.1:8902'+OG_PATH,SHARE_OG_KEY_CURRENT:ogKey};
const stagingEnv={...localEnv,SHARE_LINKS_ENV:'staging',SHARE_LINKS_PUBLIC_ORIGIN:STAGING_ORIGIN,SHARE_PREVIEW_URL:EP.preview,SHARE_OG_SOURCE_URL:EP.source};
const prodEnv={...stagingEnv,SHARE_LINKS_ENV:'production',SHARE_LINKS_PUBLIC_ORIGIN:site.url};
test('6E entornos: cada política solo acepta su propio entorno completo',async()=>{
 assert.equal(readConfig(localEnv).state,'active');
 for(const env of [stagingEnv,prodEnv])assert.equal(readConfig(env).state,'invalid');
 assert.equal((await stagingPolicy.readConfig(stagingEnv)).state,'active');
 for(const env of [localEnv,prodEnv,{...stagingEnv,SHARE_LINKS_PUBLIC_ORIGIN:site.url}])assert.equal((await stagingPolicy.readConfig(env)).state,'invalid');
 // El pin real compilado nunca coincide con el proyecto ficticio de los tests.
 assert.equal((await createStagingPolicy().readConfig(stagingEnv)).state,'invalid');
});
test('6E entornos: OG local rechaza endpoints STAGING/PROD y OG STAGING rechaza loopback u otro proyecto',async()=>{
 const localPreview=readConfig(localEnv).config,req=new Request(localPreview.origin+'/p/'+token);
 assert.equal(readOgConfig(localEnv,localPreview,req,true).state,'active');
 for(const SHARE_OG_SOURCE_URL of [EP.source,'https://'+site.domain+OG_PATH])
  assert.equal(readOgConfig({...localEnv,SHARE_OG_SOURCE_URL},localPreview,req,true).state,'invalid');
 assert.equal(readOgConfig({...localEnv,SHARE_LINKS_ENV:'production'},localPreview,req,true).state,'invalid');
 const preview=(await stagingPolicy.readConfig(stagingEnv)).config;
 const sreq=new Request(STAGING_ORIGIN+'/p/'+token),allow=()=>true;
 assert.equal(stagingOgConfig(stagingEnv,preview,sreq,allow,PROJECT).state,'active');
 for(const [env,project] of [[{...stagingEnv,SHARE_OG_SOURCE_URL:localEnv.SHARE_OG_SOURCE_URL},PROJECT],
  [stagingEnv,'zyxwvutsrq9876543210'],[{...stagingEnv,SHARE_LINKS_ENV:'production'},PROJECT],[stagingEnv,null]])
  assert.equal(stagingOgConfig(env,preview,sreq,allow,project).state,'invalid');
 assert.equal(stagingOgConfig(stagingEnv,preview,sreq,()=>false,PROJECT).state,'disabled');
});
test('6E entornos: orígenes públicos separados y sin solapamiento',()=>{
 assert.equal(site.url,'https://www.rlvo.com.mx');
 assert.notEqual(new URL(STAGING_ORIGIN).hostname.endsWith(site.domain),true);
 assert(new URL(STAGING_ORIGIN).hostname.endsWith('.workers.dev'));
});
