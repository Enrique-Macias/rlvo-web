import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const files = await readdir(root, { recursive: true });
const htmlFiles = files.filter(file => file.endsWith('.html'));
let failures = 0;
let pendingCount = 0;
let scriptCount = 0;
const pages = new Map();
for (const file of htmlFiles) pages.set(file, await readFile(path.join(root, file), 'utf8'));
for (const [file, html] of pages) {
  const fail = message => { console.error(`${file}: ${message}`); failures++; };
  for (const [name, pattern] of Object.entries({
    title: /<title>[^<]+<\/title>/,
    description: /<meta\s+name="description"\s+content="[^"]+"/,
    canonical: /<link\s+rel="canonical"\s+href="https:\/\//,
    language: /<html\s+lang="es-MX"/,
    openGraph: /property="og:title"/,
  })) if (!pattern.test(html)) fail(`Falta ${name}`);
  if ((html.match(/<h1(?:\s|>)/g) ?? []).length !== 1) fail('Se requiere exactamente un h1');
  if (/<form(?:\s|>)/.test(html)) fail('Formulario no autorizado');
  const scripts = html.match(/<script(?:\s|>)/g) ?? [];
  scriptCount += scripts.length;
  if (scripts.length) fail('JavaScript inesperado: revisar el alcance estático');
  pendingCount += (html.match(/\[\[POR CONFIRMAR/g) ?? []).length;
  for (const match of html.matchAll(/<(?:img|script|link)\b[^>]*\b(?:src|href)="(https?:\/\/[^\"]+)"/g)) {
    if (!match[0].includes('rel="canonical"')) fail(`Recurso externo inesperado: ${match[1]}`);
  }
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^\"]+)"/g)) {
    const href = match[1];
    if (/^(?:mailto:|https?:)/.test(href)) continue;
    const [pathname, hash] = href.split('#');
    const dest = !pathname ? file : pathname === '/' ? 'index.html' : pathname.replace(/^\//, '').replace(/\/$/, '') + '.html';
    if (!pages.has(dest)) { fail(`Enlace interno sin destino: ${href}`); continue; }
    if (hash && !pages.get(dest).includes(`id="${hash}"`)) fail(`Anchor inexistente: ${href}`);
  }
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^\"]+)"/g)) {
    try { await stat(path.join(root, match[1])); } catch { fail(`Imagen inexistente: ${match[1]}`); }
  }
}
const sitemapFiles = files.filter(file => /sitemap.*\.xml$/.test(file));
if (process.env.SITE_ENV !== 'preview' && sitemapFiles.length === 0) { console.error('Sitemap ausente'); failures++; }
for (const file of sitemapFiles) {
  const xml = await readFile(path.join(root, file), 'utf8');
  if (/<loc>[^<]*\/(?:404|privacidad|terminos|eliminar-cuenta)\/?<\/loc>/.test(xml)) { console.error('Página noindex en sitemap'); failures++; }
}
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
if (process.env.SITE_ENV !== 'preview' && robots.includes('Disallow: /')) { console.error('Producción bloqueada en robots'); failures++; }
console.log(`Auditoría estática: ${htmlFiles.length} páginas, enlaces y anchors revisados; ${scriptCount} scripts de cliente.`);
if (pendingCount) console.warn(`ADVERTENCIA: ${pendingCount} marcadores POR CONFIRMAR en páginas legales. Son borradores noindex. Resolver y revisar antes de producción.`);
if (failures) process.exit(1);
