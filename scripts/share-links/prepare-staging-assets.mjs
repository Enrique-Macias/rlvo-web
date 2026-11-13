import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const ASSET_DIRECTORY = '.wrangler/share-links-staging-assets';
export const TEMPLATE = '/compartir/plantilla.html';
export const BRAND = '/brand/07_logo_horizontal_verde_transparente.svg';
export const FAVICON = '/favicon.svg';
export const OG = '/og/rlvo-paleta-06.png';
export const ROBOTS = 'User-agent: *\nDisallow: /\n';
export const NOT_FOUND = '<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="robots" content="noindex, nofollow, noarchive"><title>Enlace no disponible | RLVO</title><h1>Este enlace no está disponible</h1></html>';
const fixed = new Set([TEMPLATE, BRAND, FAVICON, OG]);
const permitted = p => fixed.has(p) || /^\/_astro\/[A-Za-z0-9_.-]+\.(?:css|woff2)$/.test(p);
const sha = b => createHash('sha256').update(b).digest('hex');

function regular(root, path) {
  assert(path.startsWith('/') && !path.includes('\\') && !path.includes('%'), 'Ruta de asset inválida');
  let current = resolve(root);
  assert(!lstatSync(current).isSymbolicLink() && lstatSync(current).isDirectory(), 'Raíz no regular');
  for (const part of path.slice(1).split('/')) {
    assert(part && part !== '.' && part !== '..', 'Traversal');
    current = join(current, part);
    const stat = lstatSync(current);
    assert(!stat.isSymbolicLink(), 'Symlink no permitido');
  }
  assert(lstatSync(current).isFile(), 'Asset no regular');
  return readFileSync(current);
}
const INTERNAL_ORIGIN = 'https://assets.invalid';
// Positive grammar for this compiled template: plain local path segments only.
// No trimming, decoding, URL-origin removal or browser normalization before validation.
export function localReference(value, from) {
  assert(typeof value === 'string' && /^(?:\.\/|\/)?[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*(?![\s\S])/.test(value), 'Referencia externa o ambigua');
  const url = new URL(value, INTERNAL_ORIGIN + from);
  assert(url.origin === INTERNAL_ORIGIN && !url.username && !url.password && !url.port && !url.search && !url.hash, 'Origen de recurso no permitido');
  assert(permitted(url.pathname), 'Asset fuera del conjunto autorizado');
  return url.pathname;
}
const htmlTags = new Set(['html','head','meta','title','link','style','body','main','img','p','h1','div','strong','a','span']);
const htmlAttributes = new Set(['lang','charset','name','content','property','rel','href','src','alt','width','height','id','class','aria-hidden','data-share-links-template']);
function attributes(raw) {
  const attrs = new Map();
  // Deliberately bounded to the compiled template. Unsupported markup fails closed.
  const attr = /\s+([A-Za-z][A-Za-z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
  let offset = 0;
  while (offset < raw.length && raw.slice(offset).trim() !== '') {
    attr.lastIndex = offset;
    const m = attr.exec(raw);
    assert(m, 'Atributo HTML no soportado');
    const name = m[1].toLowerCase();
    assert(!attrs.has(name), 'Atributo duplicado');
    assert(htmlAttributes.has(name) || /^data-astro-cid-[a-z0-9]+$/.test(name), 'Superficie HTML no soportada');
    attrs.set(name, m[2] ?? m[3] ?? null);
    offset = attr.lastIndex;
  }
  return attrs;
}
function cssReferences(text, path) {
  // No CSS escapes/comments or alternative resource-loading syntaxes in this subset.
  assert(!/\\|\/\*|@import\b|(?:image-set|image|src|paint)\s*\(|sourceMappingURL|cloudflareinsights/i.test(text), 'CSS no soportado o externo');
  const urls = [...text.matchAll(/\burl\((?:"([^"]*)"|'([^']*)'|([^()"']*))\)/gi)];
  assert.equal(urls.length, [...text.matchAll(/\burl\s*\(/gi)].length, 'CSS url no soportado');
  return urls.map(m => localReference(m[1] ?? m[2] ?? m[3], path));
}
function references(path, bytes) {
  const text = bytes.toString('utf8'), found = [];
  if (path === TEMPLATE) {
    assert(text.includes('data-share-links-template="v1"') && /noindex, nofollow, noarchive/.test(text), 'Plantilla incorrecta');
    assert(!/<!--|cloudflareinsights|beacon\.min/i.test(text), 'Contenido no soportado o analytics');
    const tags = [...text.matchAll(/<([a-z][a-z0-9-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)];
    assert.equal(tags.length, [...text.matchAll(/<[a-z]/gi)].length, 'HTML no soportado');
    for (const m of tags) {
      const tag = m[1].toLowerCase();
      assert(htmlTags.has(tag), 'Elemento HTML no soportado');
      const attrs = attributes(m[2]);
      assert(!attrs.has('src') || tag === 'img', 'src fuera de img');
      assert(!attrs.has('href') || tag === 'link' || tag === 'a', 'href fuera de link o navegación');
      if (tag === 'img') found.push(localReference(attrs.get('src'), path));
      if (tag === 'link') {
        const rel = attrs.get('rel');
        assert(['canonical','stylesheet','icon','preload'].includes(rel), 'Relación link no soportada');
        if (rel !== 'canonical') found.push(localReference(attrs.get('href'), path));
      }
    }
    // Navigation and canonical/OG metadata are not browser resource fetches.
    // Resource href/src and inline style blocks are the only accepted loading surfaces.
    for (const m of text.matchAll(/<style>([\s\S]*?)<\/style>/gi)) found.push(...cssReferences(m[1], path));
    assert.equal([...text.matchAll(/<style\b/gi)].length, [...text.matchAll(/<style>[\s\S]*?<\/style>/gi)].length, 'Bloque style no soportado');
  }
  if (path.endsWith('.css')) found.push(...cssReferences(text, path));
  return found;
}
export function collectAssets(source) {
  const files = new Map(), pending = [TEMPLATE, BRAND, FAVICON, OG];
  while (pending.length) {
    const path = pending.pop();
    if (files.has(path)) continue;
    assert(permitted(path), 'Asset no permitido');
    const bytes = regular(source, path);
    files.set(path, bytes);
    pending.push(...references(path, bytes));
  }
  assert(files.get(OG).subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'OG debe ser PNG');
  files.set('/robots.txt', Buffer.from(ROBOTS));
  files.set('/404.html', Buffer.from(NOT_FOUND));
  return files;
}
function listing(root, prefix = '') {
  const paths = [];
  assert(!lstatSync(root).isSymbolicLink(), 'Directorio enlazado');
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name), stat = lstatSync(path), rel = prefix + '/' + name;
    assert(!stat.isSymbolicLink(), 'Symlink en paquete');
    if (stat.isDirectory()) paths.push(...listing(path, rel));
    else { assert(stat.isFile(), 'Entrada especial'); paths.push(rel); }
  }
  return paths.sort();
}
export function auditStagingAssets(root = resolve(ASSET_DIRECTORY)) {
  const expected = collectAssets(root), actual = listing(root);
  assert.deepEqual(actual, [...expected.keys()].sort(), 'Archivo inesperado o ausente');
  assert(regular(root, '/robots.txt').equals(Buffer.from(ROBOTS)), 'Robots no bloqueante');
  assert(regular(root, '/404.html').equals(Buffer.from(NOT_FOUND)), '404 no genérico');
  return [...expected].sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)}));
}
export function prepareStagingAssets({source = resolve('dist'), output = resolve(ASSET_DIRECTORY)} = {}) {
  const files = collectAssets(source);
  const allowedRoot = resolve('.wrangler');
  assert(output.startsWith(allowedRoot + sep) && output !== allowedRoot, 'Salida fuera de .wrangler');
  // Refuse symlink ancestors before removing or creating any generated output.
  mkdirSync(allowedRoot, { recursive: true });
  let ancestor = allowedRoot;
  assert(!lstatSync(ancestor).isSymbolicLink(), 'Raíz de salida enlazada');
  for (const part of relative(allowedRoot, output).split(sep)) {
    assert(part && part !== '.' && part !== '..', 'Salida ambigua');
    ancestor = join(ancestor, part);
    if (existsSync(ancestor)) assert(!lstatSync(ancestor).isSymbolicLink(), 'Ancestro enlazado');
  }
  if (existsSync(output)) { listing(output); rmSync(output, {recursive:true}); }
  mkdirSync(output, { recursive: true });
  for (const [path,bytes] of files) {
    const target = join(output, path.slice(1));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  return auditStagingAssets(output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'No se admiten overrides');
  const files = prepareStagingAssets();
  console.log(JSON.stringify({stagingAssets:'PASS',files}));
}
