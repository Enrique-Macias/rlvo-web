import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await read('src/config/brand-assets.json'));
assert.equal(Object.keys(manifest).length, 18, 'Se requieren los 18 SVG oficiales');
for (const [file, hash] of Object.entries(manifest)) {
  for (const location of ['public/brand/', 'dist/brand/']) {
    assert.equal(digest(await read(location + file)), hash, `${location + file}: SVG alterado`);
  }
  let reference;
  try { reference = await read('brand-reference/' + file); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (reference) assert.equal(digest(reference), hash, `${file}: difiere del kit de referencia`);
}
for (const file of ['public/favicon.svg', 'dist/favicon.svg']) {
  assert.equal(digest(await read(file)), manifest['06_isotipo_verde_sobre_menta-claro.svg'], `${file}: favicon alterado`);
}

const css = (await read('src/styles/tokens.css')).toString();
const declarations = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
const resolve = (token, seen = new Set()) => {
  assert(!seen.has(token), `Token cíclico: ${token}`);
  seen.add(token);
  const value = declarations.get(token);
  assert(value, `Token inexistente: ${token}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/)?.[1];
  return reference ? resolve(reference, seen) : value;
};
const palette = new Set(['#183D39', '#23635C', '#78CDB5', '#DDF5ED', '#F5FAF8', '#FFFFFF']);
const luminance = (hex) => {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return rgb.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
};
const contrast = (foreground, background) => {
  const values = [luminance(resolve(foreground)), luminance(resolve(background))].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
};
const pairs = [
  ['--text-primary', '--surface-page'], ['--text-secondary', '--surface-page'],
  ['--text-primary', '--surface-card'], ['--text-secondary', '--surface-card'],
  ['--text-primary', '--surface-subtle'], ['--text-secondary', '--surface-subtle'],
  ['--text-primary', '--surface-accent'], ['--link', '--surface-page'],
  ['--text-inverse', '--action-primary'], ['--text-inverse', '--action-primary-hover'],
  ['--text-inverse-muted', '--surface-inverse'], ['--text-accent-inverse', '--surface-inverse'],
];
for (const [foreground, background] of pairs) {
  assert(contrast(foreground, background) >= 4.5, `${foreground}/${background}: contraste de texto insuficiente`);
}
for (const background of ['--surface-page', '--surface-card', '--surface-subtle']) {
  assert(contrast('--focus-ring', background) >= 3, `Foco insuficiente sobre ${background}`);
}
const sourceFiles = await readdir(new URL('src/', root), { recursive: true });
for (const file of sourceFiles.filter((file) => /\.(?:astro|css|ts)$/.test(file))) {
  const source = (await read('src/' + file)).toString();
  assert(!/var\(--(?:ink|ink-soft|paper|card|brick|forest|gold|slate|line)\)/.test(source), `${file}: token anterior`);
  for (const color of source.match(/#[\da-f]{3,8}\b/gi) ?? []) {
    assert(palette.has(color.toUpperCase()), `${file}: color fuera de Paleta 06 (${color})`);
  }
}
const og = await sharp(await read('dist/og/rlvo-paleta-06.png')).metadata();
assert.equal(og.width, 1200); assert.equal(og.height, 630);
for (const file of (await readdir(new URL('dist/', root))).filter((file) => file.endsWith('.html'))) {
  const html = (await read('dist/' + file)).toString();
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1];
  assert(canonical, `${file}: canonical ausente`);
  assert.equal(new URL(canonical).origin, 'https://www.rlvo.com.mx', `${file}: host canónico incorrecto`);
  assert(html.includes(`property="og:url" content="${canonical}"`), `${file}: Open Graph URL inconsistente`);
  assert(html.includes('property="og:image" content="https://www.rlvo.com.mx/og/rlvo-paleta-06.png"'), `${file}: falta Open Graph`);
  assert(html.includes(`name="theme-color" content="${resolve('--surface-page')}"`), `${file}: theme-color no coincide con tokens`);
  assert.equal((html.match(/class="brand-logo"/g) ?? []).length, 2, `${file}: logos de header/footer ausentes`);
}
console.log(`Branding: 18 SVG y favicon intactos; ${pairs.length} pares AA, foco, tokens, Open Graph y logos verificados.`);
