import sharp from 'sharp';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const names = ['home-marketplace', 'category-browse', 'create-listing', 'user-profile', 'product-detail'];
const out = new URL('../public/media/', import.meta.url);
await mkdir(out, { recursive: true });
await mkdir(new URL('licenses/', out), { recursive: true });
for (const font of ['inter', 'fraunces']) {
  await copyFile(new URL(`../node_modules/@fontsource-variable/${font}/LICENSE`, import.meta.url), new URL(`licenses/${font}.txt`, out));
}
const manifest = {};
for (const name of names) {
  const original = await readFile(new URL(`../public/screenshots/${name}.png`, import.meta.url));
  const metadata = await sharp(original).metadata();
  manifest[name] = { width: metadata.width, height: metadata.height, sha256: createHash('sha256').update(original).digest('hex') };
  for (const width of [360, 512, 640, 960]) {
    await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 88 }).toFile(new URL(`${name}-${width}.webp`, out).pathname);
  }
}
await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2));
console.log('Capturas: originales intactos; derivados WebP a 360, 512, 640 y 960 px.');
