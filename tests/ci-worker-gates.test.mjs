// PL-085 Fase 6E — gates de CI del Worker Share Links/OG. Archivo protegido por la política de
// control (prefijo tests/ci-): debilitarlo exige la misma autorización externa que los workflows.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const pkg=JSON.parse(readFileSync('package.json','utf8'));
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
const verify=readFileSync('scripts/ci/verify-web.mjs','utf8');
const steps=[...verify.matchAll(/^\s*(?:await\s+)?(run\(\[[^\]]*\]\)|checkHttp\(\)|verifyDraftPolicy\(old)/gm)].map(m=>m[1]);
const WORKER_CHAIN=['node scripts/share-links/prepare-staging-assets.mjs','npm run check:worker','npm run test:share-links',
 'node scripts/share-links/test-og-negative.mjs','node scripts/share-links/test-og-staging-negative.mjs'];

test('CI ejecuta el Worker tras el build de producción y antes de la verificación final',()=>{
 const build=steps.lastIndexOf("run(['run', 'build'])"),worker=steps.indexOf("run(['run', 'ci:worker'])");
 assert(build>=0&&worker>build,'ci:worker debe ir después del último build');
 assert.equal(steps[worker-1],'checkHttp()');assert.equal(steps[worker+1],'verifyDraftPolicy(old');
 assert.equal(steps.filter(s=>s.includes('ci:worker')).length,1);
 assert(!/\|\|\s*true|catch\s*\{\s*\}|continue-on-error/.test(verify),'sin pasos permisivos');
});
test('ci:worker encadena typecheck, suites Share Links/OG y controles negativos sin atajos',()=>{
 assert.deepEqual(pkg.scripts['ci:worker'].split(' && '),WORKER_CHAIN);
 assert.equal(pkg.scripts['check:worker'],'tsc -p worker/tsconfig.json');
 assert.equal(pkg.scripts['test:share-links'],'node --experimental-strip-types --test --test-concurrency=1 tests/share-links/*.test.mjs');
 assert.equal(pkg.scripts['ci:share-links'],'npm run ci:web');assert.equal(pkg.scripts['ci:web'],'node scripts/ci/verify-web.mjs');
 const suites=readdirSync('tests/share-links').filter(f=>f.endsWith('.test.mjs'));
 for(const required of ['core','runtime','audit','og-core','og-runtime','og-contract','og-bundle','og-staging','og-staging-tools',
  'staging-config','staging-runtime','staging-assets','staging-private-target','config-integrity','public-material'])
  assert(suites.includes(required+'.test.mjs'),required);
});
test('Wrangler fijado a versión exacta, coherente con el lock y con miniflare/workerd/esbuild usados por los tests',()=>{
 const version=pkg.devDependencies.wrangler;
 assert.match(version,/^\d+\.\d+\.\d+$/,'sin rangos, latest ni tags');
 assert.equal(pkg.dependencies?.wrangler,undefined);
 const entry=lock.packages['node_modules/wrangler'];
 assert.equal(entry.version,version);assert.equal(entry.resolved,`https://registry.npmjs.org/wrangler/-/wrangler-${version}.tgz`);
 assert.match(entry.integrity,/^sha512-/);assert.equal(entry.dev,true);
 for(const dep of ['miniflare','workerd','esbuild']){
  assert.equal(lock.packages['node_modules/'+dep]?.version,entry.dependencies[dep],dep+' alineado con wrangler');
  assert.equal(lock.packages['node_modules/wrangler/node_modules/'+dep],undefined,dep+' sin copia anidada divergente');
 }
 for(const platform of ['@cloudflare/workerd-linux-64','@esbuild/linux-x64','@img/sharp-linux-x64'])assert(lock.packages['node_modules/'+platform],platform+' para el runner Linux');
});
test('ningún script ni workflow puede desplegar, autenticar o publicar en Cloudflare',()=>{
 const scripts=Object.entries(pkg.scripts);
 for(const [name,command] of scripts){
  assert(!/\bdeploy\b|versions\s+upload|secret\s+(put|bulk)|\blogin\b|wrangler@|npx\s+(-y\s+)?wrangler|--remote\b|\bpublish\b/.test(command),`${name}: ${command}`);
  if(/\bwrangler\b/.test(command))assert(/--local\b/.test(command)&&/--ip 127\.0\.0\.1\b/.test(command),`${name}: wrangler solo local`);
 }
 for(const file of readdirSync('.github/workflows')){
  const text=readFileSync('.github/workflows/'+file,'utf8');
  assert(!/wrangler|cloudflare|CLOUDFLARE_|CF_API|deploy/i.test(text.replace(/deployment:\s*false/g,'')),file);
 }
 for(const file of readdirSync('scripts/ci'))assert(!/wrangler|CLOUDFLARE_|api\.cloudflare\.com/.test(readFileSync('scripts/ci/'+file,'utf8')),file);
});

// ---- 6E-R1: cobertura de la política de control (la evaluación de un PR usa la política de la BASE) ----
const policy=JSON.parse(readFileSync('ci/control-policy.json','utf8'));
// Política v1 previa (c98bd23): la ampliación no puede retirar ninguna entrada ni tocar el piso jurídico.
const V1={criticalDirectories:['.github','scripts/ci','src/legal'],
 criticalFiles:['ci/control-policy.json','scripts/check-legal-baseline.mjs','scripts/verify-legal.ts','scripts/normalize-legal.ts',
  'scripts/audit-static.mjs','scripts/audit-brand.mjs','scripts/audit-legal.ts','scripts/audit-legal-http.ts','scripts/prepare-assets.mjs',
  'scripts/prepare-brand.mjs','tests/fixtures/legal-migration.json','package.json','package-lock.json','astro.config.mjs','tsconfig.json',
  '.gitattributes','.npmrc','.gitmodules','.node-version','.nvmrc','docs/CI_CONTROL_INTEGRITY.md'],
 criticalFilePrefixes:['tests/ci-','tests/legal-'],
 nonAuthorizableDirectories:['legal','src/content/legal'],
 nonAuthorizableFiles:['src/config/legal-current.json','docs/PL-016-WEB-INTEGRATION-CONTRACT.md','docs/LEGAL_FACTS.md',
  'src/content/legal.ts','src/pages/eliminar-cuenta.astro','src/config/site.ts']};
const OG_ASSETS={'public/og/rlvo-paleta-06.png':'43046d631a9a94648220ac8edceae8d4ef4f13baabc8cc9e3e8d838346f34093',
 'public/brand/11_logo_horizontal_menta_sobre_verde.svg':'cf2999f665021cdcdc9abfe918c2b45eb2a68851c40c7d8a031613dba777516b',
 // Fuente del fallback: scripts/prepare-brand.mjs regenera el PNG desde este SVG en cada build.
 'public/brand/09_logo_horizontal_blanco_transparente.svg':'9aa46903036d34fad1414beb3f0d7725e757997e7f1fd2efedc256bd90419fa8'};
const WORKER_SCOPES={criticalDirectories:['worker','scripts/share-links','tests/share-links','src/pages/compartir'],criticalFilePrefixes:['wrangler'],
 criticalFiles:Object.keys(OG_ASSETS)};
const covered=path=>policy.criticalDirectories.some(d=>path===d||path.startsWith(d+'/'))||policy.criticalFiles.includes(path)||
 policy.criticalFilePrefixes.some(p=>path.startsWith(p));

test('6E-R1: la política solo se amplía; piso jurídico y entradas v1 intactos',()=>{
 assert.equal(policy.schemaVersion,1);assert.equal(policy.repository,'Enrique-Macias/rlvo-web');
 for(const [key,values] of Object.entries(V1)){
  for(const value of values)assert(policy[key].includes(value),`${key}: ${value} retirado`);
  if(key.startsWith('nonAuthorizable'))assert.deepEqual(policy[key],values,'el piso jurídico no cambia');
 }
 for(const [key,values] of Object.entries(WORKER_SCOPES))for(const value of values)assert(policy[key].includes(value),`${key}: ${value}`);
});
test('6E-R1: todo archivo versionado del Worker, Wrangler y Share Links queda bajo control',async()=>{
 const {execFileSync}=await import('node:child_process');
 const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const scoped=files.filter(f=>/^(worker|scripts\/share-links|tests\/share-links|src\/pages\/compartir)\//.test(f)||/^wrangler/.test(f));
 for(const known of ['worker/og-handler.ts','worker/og-staging-fixtures.json','wrangler.jsonc','wrangler.share-links.og.staging.jsonc',
  'tests/share-links/og-core.test.mjs','scripts/share-links/test-og-negative.mjs','src/pages/compartir/plantilla.astro'])assert(scoped.includes(known),'inventario incompleto: '+known);
 for(const f of [...scoped,'scripts/ci/verify-web.mjs','tests/ci-worker-gates.test.mjs','.github/CODEOWNERS'])assert(covered(f),f);
 for(const f of ['README.md','src/pages/index.astro','docs/SHARE_LINKS_OG_PHASE_6E.md','public/brand/07_logo_horizontal_verde_transparente.svg'])assert(!covered(f),'fuera de alcance: '+f);
});
test('6E-R2: assets OG oficiales protegidos con su contenido aprobado',async()=>{
 const {createHash}=await import('node:crypto');
 for(const [path,sha] of Object.entries(OG_ASSETS)){
  assert(covered(path),path);
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),sha,'contenido aprobado: '+path);
 }
 // El distintivo embebido declara el mismo SVG fuente; el fallback servido es el PNG protegido.
 assert(readFileSync('worker/og-badge.ts','utf8').includes('Source SHA-256: '+OG_ASSETS['public/brand/11_logo_horizontal_menta_sobre_verde.svg']));
 assert(readFileSync('src/config/site.ts','utf8').includes("image: '/og/rlvo-paleta-06.png'"));
});
test('6E-R2: toda entrada directa del generador del fallback está protegida o documentada como caso amplio',()=>{
 const generator=readFileSync('scripts/prepare-brand.mjs','utf8');
 assert(covered('scripts/prepare-brand.mjs'));
 const inputs=[...generator.matchAll(/readFile\(new URL\('\.\.\/([^']+)'/g)].map(m=>m[1]).sort();
 // tokens.css define 36 tokens de todo el sitio; audit-brand.mjs (crítico) limita sus colores a la Paleta 06.
 const BROADER=['src/styles/tokens.css'];
 assert.deepEqual(inputs,['public/brand/09_logo_horizontal_blanco_transparente.svg','src/styles/tokens.css'],'entradas del generador cambiaron: revisar protección');
 for(const input of inputs)assert(covered(input)||BROADER.includes(input),input);
 assert(/writeFile\(new URL\('rlvo-paleta-06\.png', out\)/.test(generator),'el generador escribe el fallback protegido');
 // El manifiesto de marca (no crítico) debe coincidir con el contenido aprobado de los SVG protegidos.
 const manifest=JSON.parse(readFileSync('src/config/brand-assets.json','utf8'));
 for(const svg of ['09_logo_horizontal_blanco_transparente.svg','11_logo_horizontal_menta_sobre_verde.svg'])
  assert.equal(manifest[svg],OG_ASSETS['public/brand/'+svg],svg);
});
