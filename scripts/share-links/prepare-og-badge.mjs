import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const original = await readFile(new URL('../../public/brand/11_logo_horizontal_menta_sobre_verde.svg', import.meta.url));
const png = await sharp(original).resize({ width: 240 }).png({ compressionLevel: 9 }).toBuffer();
const metadata = await sharp(png).metadata();
if (metadata.width !== 240 || metadata.height !== 90) throw new Error('Dimensiones oficiales inesperadas');
const code = `// Generated from the intact official SVG by scripts/share-links/prepare-og-badge.mjs.\n// Source SHA-256: ${createHash('sha256').update(original).digest('hex')}\nexport const badgeBase64 = '${png.toString('base64')}';\n`;
const target = new URL('../../worker/og-badge.ts', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== code) throw new Error('Distintivo no reproducible');
} else await writeFile(target, code);
