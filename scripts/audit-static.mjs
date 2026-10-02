import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const files = await readdir(root, { recursive: true });
const htmlFiles = files.filter(file => file.endsWith('.html'));
let failures = 0;
const markerCounts = { 'POR CONFIRMAR': 0, PENDIENTE: 0, 'VALIDAR CON ABOGADO': 0 };
let scriptCount = 0;
let beaconCount = 0;
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
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  scriptCount += scripts.length;
  const beaconScripts = scripts.filter(script =>
    /\stype="module"/.test(script) &&
    /\ssrc="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/.test(script),
  );
  beaconCount += beaconScripts.length;
  if (scripts.length !== 1 || beaconScripts.length !== 1) {
    fail('Se requiere exactamente el script oficial de Cloudflare Web Analytics');
  } else {
    const beaconAttributes = beaconScripts[0].match(/\sdata-cf-beacon=/g) ?? [];
    if (beaconAttributes.length !== 1) {
      fail('Se requiere exactamente un atributo data-cf-beacon');
    } else {
      const attribute = beaconScripts[0].match(/\sdata-cf-beacon=(["'])(.*?)\1/);
      const configJson = (attribute?.[2] ?? '').replaceAll('&quot;', '"');
      try {
        const config = JSON.parse(configJson);
        if (
          typeof config !== 'object' ||
          config === null ||
          typeof config.token !== 'string' ||
          !/^[0-9a-f]{32}$/i.test(config.token)
        ) {
          fail('El atributo data-cf-beacon no contiene una configuración válida');
        }
      } catch {
        fail('El atributo data-cf-beacon no contiene JSON válido');
      }
    }
  }
  for (const marker of Object.keys(markerCounts)) {
    markerCounts[marker] += (html.match(new RegExp(`\\[\\[${marker}`, 'g')) ?? []).length;
  }
  for (const match of html.matchAll(/<(?:img|script|link)\b[^>]*\b(?:src|href)="(https?:\/\/[^\"]+)"/g)) {
    const allowedCloudflareBeacon = match[0].startsWith('<script') &&
      match[1] === 'https://static.cloudflareinsights.com/beacon.min.js';
    if (!match[0].includes('rel="canonical"') && !allowedCloudflareBeacon) {
      fail(`Recurso externo inesperado: ${match[1]}`);
    }
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
for (const file of ['privacidad.html', 'terminos.html', 'eliminar-cuenta.html']) {
  const html = pages.get(file) ?? '';
  if (!html.includes('mailto:privacidad@rlvo.com.mx')) {
    console.error(`${file}: falta el canal de privacidad configurado`);
    failures++;
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
console.log(`Auditoría estática: ${htmlFiles.length} páginas, enlaces y anchors revisados; ${beaconCount} beacons permitidos, ${scriptCount - beaconCount} scripts adicionales.`);
const markerSummary = Object.entries(markerCounts).filter(([, count]) => count > 0).map(([name, count]) => `${name}: ${count}`).join(', ');
if (markerSummary) console.warn(`ADVERTENCIA: marcadores legales en páginas generadas (${markerSummary}). Son borradores noindex. Resolver y revisar antes de producción.`);
if (failures) process.exit(1);
