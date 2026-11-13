import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,rmSync,writeFileSync,readFileSync,symlinkSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {prepareStagingAssets,auditStagingAssets,ASSET_DIRECTORY,localReference,BRAND,TEMPLATE} from '../../scripts/share-links/prepare-staging-assets.mjs';
import {EXPECTED,validateStagingTarget,checkStagingTarget} from '../../scripts/share-links/check-staging-target.mjs';
const temp=fn=>{mkdirSync('.wrangler',{recursive:true});const p=mkdtempSync(resolve('.wrangler/w2-assets-'));try{return fn(p);}finally{rmSync(p,{recursive:true,force:true});}};
test('W2: paquete reproducible y dependencias reales completas',()=>temp(p=>{
 const output=join(p,'out'),a=prepareStagingAssets({output}),b=prepareStagingAssets({output});assert.deepEqual(a,b);
 const paths=a.map(f=>f.path);for(const x of ['/robots.txt','/404.html','/compartir/plantilla.html','/og/rlvo-paleta-06.png','/favicon.svg','/brand/07_logo_horizontal_verde_transparente.svg'])assert(paths.includes(x));
 assert(paths.some(p=>p.endsWith('.woff2')));assert(paths.every(p=>!/\.(?:js|map)$|legal|index\.html|\.env/i.test(p)));
}));
test('W2: preparación y guard reales no seleccionan producción',()=>{
 prepareStagingAssets();assert.equal(checkStagingTarget([]).guard,'PASS');
 assert.deepEqual(auditStagingAssets(),auditStagingAssets(resolve(ASSET_DIRECTORY)));
});
for(const [name,mutate] of [
 ['landing',p=>writeFileSync(join(p,'index.html'),'landing')],
 ['legal',p=>{mkdirSync(join(p,'legal'));writeFileSync(join(p,'legal/manifest.json'),'{}');}],
 ['env',p=>writeFileSync(join(p,'.env'),'SYNTHETIC=fixture')],
 ['sourcemap',p=>writeFileSync(join(p,'bundle.js.map'),'{}')],
 ['css ajeno',p=>writeFileSync(join(p,'_astro/extra.css'),'body{}')],
 ['robots abierto',p=>writeFileSync(join(p,'robots.txt'),'User-agent: *\nAllow: /\n')],
 ['script',p=>{const f=join(p,'compartir/plantilla.html');writeFileSync(f,readFileSync(f,'utf8')+'<script>synthetic</script>');}],
 ['fuente ausente',p=>rmSync(join(p,'_astro',auditStagingAssets(p).find(f=>f.path.endsWith('.woff2')).path.split('/').at(-1)))],
 ['symlink',p=>{const f=join(p,'favicon.svg');rmSync(f);symlinkSync(resolve('public/favicon.svg'),f);}]
])test('W2: auditor rechaza '+name,()=>temp(p=>{const out=join(p,'out');prepareStagingAssets({output:out});mutate(out);assert.throws(()=>auditStagingAssets(out));}));
test('W2: symlink en fuente no permite copiar fuera del build',()=>temp(p=>{
 const source=join(p,'source');cpSync('dist',source,{recursive:true});rmSync(join(source,'favicon.svg'));symlinkSync(resolve('public/favicon.svg'),join(source,'favicon.svg'));
 assert.throws(()=>prepareStagingAssets({source,output:join(p,'out')}));
}));
test('W2: symlink en salida no permite escribir fuera del paquete',()=>temp(p=>{
 const out=join(p,'out');symlinkSync(resolve('dist'),out);assert.throws(()=>prepareStagingAssets({output:out}));
}));
for(const [name,mutate] of [
 ['nombre producción',c=>{c.name='rlvo-public-web';}],['entrada local',c=>{c.main='worker/index.ts';}],
 ['assets landing',c=>{c.assets.directory='./dist';}],['Worker-first incompleto',c=>{c.assets.run_worker_first=['/p/*'];}],
 ['route producción',c=>{c.routes=['www.rlvo.com.mx/*'];}],['custom domain',c=>{c.routes=[{pattern:'rlvo.com.mx',custom_domain:true}];}],
 ['ingreso',c=>{c.workers_dev=true;}],['previews',c=>{c.preview_urls=true;}],['logs',c=>{c.observability.enabled=true;}],
 ['activación',c=>{c.vars.SHARE_LINKS_ENABLED='true';}],['secreto',c=>{c.vars.SHARE_PREVIEW_KEY_CURRENT='synthetic-key';}],
 ['ambiente heredado',c=>{c.env={production:{name:'rlvo-public-web'}};}],['endpoint',c=>{c.vars.SHARE_PREVIEW_URL='https://example.invalid';}]
])test('W2: guard rechaza '+name,()=>{const c=structuredClone(EXPECTED);mutate(c);assert.throws(()=>validateStagingTarget(c));});
for(const path of ['wrangler.jsonc','wrangler.share-links.jsonc'])test('W2: guard rechaza configuración '+path,()=>assert.throws(()=>validateStagingTarget(EXPECTED,{configPath:path})));
for(const arg of ['--name','--env','--config','--route','--workers-dev'])test('W2: guard rechaza override '+arg,()=>assert.throws(()=>validateStagingTarget(EXPECTED,{args:[arg,'synthetic']})));

for(const key of ['CLOUDFLARE_ENV','WRANGLER_ENV','WRANGLER_CONFIG','WRANGLER_CONFIG_PATH','WRANGLER_NAME','CLOUDFLARE_WORKER_NAME'])test('W2: guard rechaza variable de selección '+key,()=>assert.throws(()=>validateStagingTarget(EXPECTED,{targetEnv:{[key]:'synthetic'}})));

// F1: the same adversarial reference must fail both before output creation and
// when injected into an already generated, physically complete eight-file package.
const external = 'https://external-review.invalid' + BRAND;
const invalidReferences = [
 ['HTTPS externo',external], ['espacio inicial',' '+external], ['espacio final',external+' '],
 ['tab inicial','\t'+external], ['CRLF','\r\n'+external], ['control NUL','\0'+external],
 ['control DEL',external+'\x7f'], ['protocolo relativo','//external-review.invalid'+BRAND],
 ['protocolo relativo con espacio',' //external-review.invalid'+BRAND],
 ['backslash',String.raw`\\external-review.invalid${BRAND}`],
 ['backslash local',String.raw`/brand\07_logo_horizontal_verde_transparente.svg`],
 ['data','data:image/svg+xml,synthetic'], ['javascript','javascript:synthetic'],
 ['file','file:///brand/07_logo_horizontal_verde_transparente.svg'],
 ['credenciales','https://fixture:fixture@external-review.invalid'+BRAND],
 ['puerto','https://external-review.invalid:443'+BRAND],
 ['origen interno absoluto','https://assets.invalid'+BRAND],
 ['traversal','/brand/../brand/07_logo_horizontal_verde_transparente.svg'],
 ['traversal relativo','../brand/07_logo_horizontal_verde_transparente.svg'],
 ['traversal codificado','/brand/%2e%2e/brand/07_logo_horizontal_verde_transparente.svg'],
 ['doble codificación','/brand/%252e%252e/brand/07_logo_horizontal_verde_transparente.svg'],
 ['slash codificado','/brand%2f07_logo_horizontal_verde_transparente.svg'],
 ['entidad HTML','&#32;'+external], ['query',BRAND+'?fixture=1'], ['fragmento',BRAND+'#fixture'],
 ['ruta local con LF final',BRAND+'\n'], ['ruta local con CR final',BRAND+'\r'],
 ['ruta local con tab final',BRAND+'\t'], ['ruta local con form feed',BRAND+'\f'],
 ['ruta local con espacio',BRAND+' '], ['segmento vacío','/brand//07_logo_horizontal_verde_transparente.svg']
];
const surfaces = [
 ['img src',(html,ref)=>html.replace('src="'+BRAND+'"','src="'+ref+'"')],
 ['link href',(html,ref)=>html.replace('rel="icon" href="/favicon.svg"','rel="icon" href="'+ref+'"')],
 ['CSS url',(html,ref)=>html.replace('</style>','body{background:url("'+ref+'")}</style>')]
];
for(const [surface,mutate] of surfaces) for(const [name,ref] of invalidReferences) {
 test('F1: rechaza '+name+' en '+surface+' antes y después de empaquetar',()=>temp(p=>{
  assert.throws(()=>localReference(ref,TEMPLATE),/Referencia externa o ambigua/);
  const source=join(p,'source'),out=join(p,'out'),invalid=join(p,'invalid');
  const good=prepareStagingAssets({output:out});assert.equal(good.length,8);
  cpSync(out,source,{recursive:true});
  const f=join(source,TEMPLATE.slice(1)),html=readFileSync(f,'utf8'),changed=mutate(html,ref);
  assert.notEqual(changed,html);writeFileSync(f,changed);
  assert.throws(()=>prepareStagingAssets({source,output:invalid}));assert.equal(existsSync(invalid),false);
  writeFileSync(join(out,TEMPLATE.slice(1)),changed);
  assert.throws(()=>auditStagingAssets(out));
 }));
}
for(const [name,mutate] of [
 ['srcset',h=>h.replace('alt="RLVO"','srcset="'+external+' 1x" alt="RLVO"')],
 ['src sin comillas',h=>h.replace('src="'+BRAND+'"','src='+external)],
 ['src duplicado',h=>h.replace('alt="RLVO"','src="'+external+'" alt="RLVO"')],
 ['style en atributo',h=>h.replace('alt="RLVO"','style="background:url('+external+')" alt="RLVO"')],
 ['CSS url malformado',h=>h.replace('</style>','body{background:url("'+external+')}</style>')],
 ['CSS escape',h=>h.replace('</style>',String.raw`body{background:u\72l("${external}")}</style>`)],
 ['CSS comentario',h=>h.replace('</style>','body{background:u/**/rl("'+external+'")}</style>')],
 ['CSS import',h=>h.replace('</style>','@import "'+external+'";</style>')],
 ['CSS image-set',h=>h.replace('</style>','body{background:image-set("'+external+'" 1x)}</style>')],
 ['link preconnect',h=>h.replace('</head>','<link rel="preconnect" href="'+external+'"></head>')],
 ['refresh',h=>h.replace('</head>','<meta http-equiv="refresh" content="0;url='+external+'"></head>')]
])test('F1: superficie no soportada falla cerrada '+name,()=>temp(p=>{
 const out=join(p,'out');prepareStagingAssets({output:out});const f=join(out,TEMPLATE.slice(1));
 writeFileSync(f,mutate(readFileSync(f,'utf8')));
 assert.throws(()=>auditStagingAssets(out));
 assert.throws(()=>prepareStagingAssets({source:out,output:join(p,'invalid')}));
}));
test('F1: CSS externo local se audita por contenido, no solo por inventario',()=>temp(p=>{
 const out=join(p,'out');prepareStagingAssets({output:out});
 const f=join(out,TEMPLATE.slice(1));writeFileSync(f,readFileSync(f,'utf8').replace('</head>','<link rel="stylesheet" href="/_astro/fixture.css"></head>'));
 const css=join(out,'_astro/fixture.css');writeFileSync(css,'body{background:url("'+BRAND+'")}');
 assert.equal(auditStagingAssets(out).length,9);
 writeFileSync(css,'body{background:url(" '+external+'")}');assert.throws(()=>auditStagingAssets(out));
 assert.throws(()=>prepareStagingAssets({source:out,output:join(p,'invalid')}));
}));
test('F1: referencias locales positivas, bytes y enlace voluntario intactos',()=>temp(p=>{
 const first=prepareStagingAssets({output:join(p,'a')}),second=prepareStagingAssets({output:join(p,'b')});
 assert.equal(first.length,8);assert.deepEqual(first,second);
 for(const file of first)assert.deepEqual(readFileSync(join(p,'a',file.path.slice(1))),readFileSync(join(p,'b',file.path.slice(1))));
 for(const ref of [BRAND,'/_astro/inter-latin-wght-normal.Dx4kXJAl.woff2'])assert.equal(localReference(ref,TEMPLATE),ref);
 assert.equal(localReference('./inter-latin-wght-normal.Dx4kXJAl.woff2','/_astro/fixture.css'),'/_astro/inter-latin-wght-normal.Dx4kXJAl.woff2');
 const html=readFileSync(join(p,'a',TEMPLATE.slice(1)),'utf8');
 assert.match(html,/<a id="rlvo-home" href="https:\/\/www\.rlvo\.com\.mx"/);
 assert.equal(readFileSync(join(p,'a/robots.txt'),'utf8'),'User-agent: *\nDisallow: /\n');
 assert.match(readFileSync(join(p,'a/404.html'),'utf8'),/noindex, nofollow, noarchive/);
}));
