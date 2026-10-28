import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const tokens = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const background = tokens.match(/--brand-primary:\s*(#[\da-f]{6});/i)?.[1];
if (!background) throw new Error('No se encontró el verde principal en tokens.css');

// La composición raster utiliza el SVG oficial intacto; nunca reescribe su fuente.
const original = await readFile(new URL('../public/brand/09_logo_horizontal_blanco_transparente.svg', import.meta.url));
const logo = await sharp(original, { density: 144 }).resize({ width: 760 }).png().toBuffer();
const { height } = await sharp(logo).metadata();
const image = await sharp({ create: { width: 1200, height: 630, channels: 3, background } })
  .composite([{ input: logo, left: 220, top: Math.round((630 - height) / 2) }])
  .png({ compressionLevel: 9 })
  .toBuffer();
const out = new URL('../public/og/', import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL('rlvo-paleta-06.png', out), image);
console.log('Open Graph: 1200 × 630, logotipo oficial sin alteraciones.');
