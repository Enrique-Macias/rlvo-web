// PL-085 Fase 6E — el repositorio público no contiene secretos, configuración privada de sesión,
// referencias reales de backend ni fotografías. Revisa archivos versionados y nuevos no ignorados
// (lo que podría entrar en un commit). Solo lectura local; sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';

const SELF='tests/share-links/public-material.test.mjs';
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'})
 .split('\0').filter(Boolean).filter(f=>{try{return lstatSync(f).isFile();}catch{return false;}}).sort();
// Proyectos ficticios usados por los tests; ninguna referencia real se versiona.
const SYNTHETIC_PROJECTS=new Set(['syntheticstaging0000','abcdefghijklmnopqrst','abcdefghij0123456789','zyxwvutsrq9876543210']);
const IMAGE_DIRS=['public/','brand-reference/'];

test('6E material: inventario legible y no vacío',()=>{assert(files.length>100);assert(files.includes('worker/og-handler.ts'));});
test('6E material: sin archivos de secretos, sesiones OG ni artefactos Wrangler',()=>{
 for(const f of files){
  assert(!/(^|\/)\.env($|\.)/.test(f)||f.endsWith('.env.example'),f);
  assert(!/(^|\/)\.dev\.vars/.test(f),f);
  assert(!/\.(pem|key|p12|pfx|jks|keystore)$/i.test(f),f);
  assert(!/(^|\/)\.wrangler\//.test(f),f);
  assert(!/og-staging-session|handoff/i.test(f),f);
  assert(!/^qa\//.test(f),f);
 }
});
test('6E material: sin fotografías; solo imágenes de marca/públicas aprobadas y ninguna en tests',()=>{
 for(const f of files){
  assert(!/\.(jpe?g|webp|heic|heif|avif|tiff?|bmp|gif|raw|dng|cr2|nef)$/i.test(f),`formato fotográfico versionado: ${f}`);
  if(/\.(png|svg|ico)$/i.test(f))assert(IMAGE_DIRS.some(d=>f.startsWith(d))||f==='public/favicon.svg',`imagen fuera de directorios aprobados: ${f}`);
  if(f.startsWith('tests/'))assert(!/\.(png|svg|ico)$/i.test(f),`fixture de imagen en tests: ${f}`);
 }
});
const PATTERNS=[
 ['JWT (anon/service_role)',/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/],
 ['clave Supabase',/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}/],
 ['clave privada PEM',/-----BEGIN [A-Z ]*PRIVATE KEY-----/],
 ['token GitHub',/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['token Cloudflare asignado',/CLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/],
 ['cuenta Cloudflare',/(?:"account_id"\s*:\s*"|\/accounts\/)[0-9a-f]{32}\b/],
 ['clave OG/preview asignada en configuración',/"SHARE_(?:OG|PREVIEW)_KEY_(?:CURRENT|NEXT)"\s*:/],
 ['ruta absoluta de equipo',/\/Users\/[A-Za-z0-9._-]+\//],
];
test('6E material: sin credenciales, cuentas, rutas de equipo ni proyectos Supabase reales',()=>{
 const findings=[];
 for(const f of files){
  if(f===SELF)continue;
  const bytes=readFileSync(f);
  if(bytes.subarray(0,8192).includes(0))continue; // binario: cubierto por el inventario de imágenes
  const text=bytes.toString('utf8');
  for(const [name,re] of PATTERNS)if(re.test(text))findings.push(`${f}: ${name}`);
  for(const m of text.matchAll(/\b([a-z0-9]{20})\.supabase\.co\b/g))if(!SYNTHETIC_PROJECTS.has(m[1]))findings.push(`${f}: proyecto Supabase no sintético`);
  for(const m of text.matchAll(/supabase\.com\/dashboard\/project\/([a-z0-9]{20})/g))if(!SYNTHETIC_PROJECTS.has(m[1]))findings.push(`${f}: proyecto Supabase no sintético`);
 }
 assert.deepEqual(findings,[]);
});
test('6E material: los patrones detectan muestras sintéticas (control positivo)',()=>{
 const sample=['eyJ'+'a'.repeat(12),'eyJ'+'b'.repeat(12),'c'].join('.');
 assert(PATTERNS[0][1].test(sample));assert(PATTERNS[1][1].test('sb_'+'secret_'+'x'.repeat(20)));
 assert(PATTERNS[5][1].test('"account_id": "'+'0'.repeat(32)+'"'));assert(PATTERNS[7][1].test('/Us'+'ers/someone/x'));
 assert(PATTERNS[6][1].test('"SHARE_OG_KEY_'+'CURRENT": "x"'));
});
