import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedPath = p => /^(?:src\/content\/legal(?:\/|\.ts)|legal\/|src\/config\/(?:site\.ts|legal-current\.json)|docs\/(?:PL-016-WEB-INTEGRATION-CONTRACT|LEGAL_FACTS)\.md|src\/pages\/eliminar-cuenta\.astro|brand-reference\/|public\/(?:brand\/|screenshots\/|favicon\.svg)|src\/components\/CloudflareWebAnalytics\.astro|wrangler\.jsonc|scripts\/ci\/|scripts\/check-legal-baseline\.mjs|tests\/ci-|tests\/legal-|tests\/fixtures\/legal-migration\.json|\.github\/)/.test(p);
// Inventario QA revisado: 70 rutas de 4B/4C.1 más las tres incorporaciones CI.
export const protectedSources = Object.freeze([
  ".github/CODEOWNERS",
  ".github/workflows/legal-trust.yml",
  ".github/workflows/web-ci.yml",
  "brand-reference/01_isotipo_verde_transparente.svg",
  "brand-reference/02_isotipo_menta_transparente.svg",
  "brand-reference/03_isotipo_blanco_transparente.svg",
  "brand-reference/04_isotipo_verde_sobre_menta.svg",
  "brand-reference/05_isotipo_menta_sobre_verde.svg",
  "brand-reference/06_isotipo_verde_sobre_menta-claro.svg",
  "brand-reference/07_logo_horizontal_verde_transparente.svg",
  "brand-reference/08_logo_horizontal_menta_transparente.svg",
  "brand-reference/09_logo_horizontal_blanco_transparente.svg",
  "brand-reference/10_logo_horizontal_verde_sobre_menta.svg",
  "brand-reference/11_logo_horizontal_menta_sobre_verde.svg",
  "brand-reference/12_logo_con_lema_verde_sobre_menta.svg",
  "brand-reference/13_logo_con_lema_menta_sobre_verde.svg",
  "brand-reference/14_logo_con_lema_blanco_transparente.svg",
  "brand-reference/15_logo_vertical_verde_transparente.svg",
  "brand-reference/16_logo_vertical_menta_transparente.svg",
  "brand-reference/17_logo_vertical_con_lema_verde_sobre_menta.svg",
  "brand-reference/18_logo_vertical_con_lema_menta_sobre_verde.svg",
  "brand-reference/LEEME.txt",
  "docs/LEGAL_FACTS.md",
  "docs/PL-016-WEB-INTEGRATION-CONTRACT.md",
  "legal/registry.json",
  "legal/releases.lock.json",
  "public/brand/01_isotipo_verde_transparente.svg",
  "public/brand/02_isotipo_menta_transparente.svg",
  "public/brand/03_isotipo_blanco_transparente.svg",
  "public/brand/04_isotipo_verde_sobre_menta.svg",
  "public/brand/05_isotipo_menta_sobre_verde.svg",
  "public/brand/06_isotipo_verde_sobre_menta-claro.svg",
  "public/brand/07_logo_horizontal_verde_transparente.svg",
  "public/brand/08_logo_horizontal_menta_transparente.svg",
  "public/brand/09_logo_horizontal_blanco_transparente.svg",
  "public/brand/10_logo_horizontal_verde_sobre_menta.svg",
  "public/brand/11_logo_horizontal_menta_sobre_verde.svg",
  "public/brand/12_logo_con_lema_verde_sobre_menta.svg",
  "public/brand/13_logo_con_lema_menta_sobre_verde.svg",
  "public/brand/14_logo_con_lema_blanco_transparente.svg",
  "public/brand/15_logo_vertical_verde_transparente.svg",
  "public/brand/16_logo_vertical_menta_transparente.svg",
  "public/brand/17_logo_vertical_con_lema_verde_sobre_menta.svg",
  "public/brand/18_logo_vertical_con_lema_menta_sobre_verde.svg",
  "public/favicon.svg",
  "public/screenshots/category-browse.png",
  "public/screenshots/create-listing.png",
  "public/screenshots/home-marketplace.png",
  "public/screenshots/product-detail.png",
  "public/screenshots/user-profile.png",
  "scripts/check-legal-baseline.mjs",
  "scripts/ci/control-policy.mjs",
  "scripts/ci/inputs.mjs",
  "scripts/ci/legal-policy.mjs",
  "scripts/ci/preview.mjs",
  "scripts/ci/trusted-legal.mjs",
  "scripts/ci/verify-web.mjs",
  "src/components/CloudflareWebAnalytics.astro",
  "src/config/legal-current.json",
  "src/config/site.ts",
  "src/content/legal.ts",
  "src/content/legal/drafts/privacidad.md",
  "src/content/legal/drafts/terminos.md",
  "src/content/legal/releases/.gitkeep",
  "src/pages/eliminar-cuenta.astro",
  "tests/ci-control-policy.test.mjs",
  "tests/ci-integrity.test.mjs",
  "tests/ci-trusted-entrypoint.test.mjs",
  "tests/ci-workflows.test.mjs",
  "tests/fixtures/legal-migration.json",
  "tests/legal-contract.test.ts",
  "tests/legal-integrity.test.ts",
  "wrangler.jsonc"
]);
export function assertProtectedSources(paths) {
  assert.deepEqual([...paths].sort(), protectedSources, 'Conjunto de fuentes protegidas inesperado');
  return protectedSources.length;
}
export function verifyProtectedFiles() {
  const entries = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD']).toString().split('\0').filter(Boolean)
    .map(line => line.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/s)).filter(m => m && protectedPath(m[2]));
  assertProtectedSources(entries.map(entry => entry[2]));
  const data = execFileSync('git', ['cat-file', '--batch'], { input: entries.map(m => m[1]).join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
  let offset = 0;
  for (const entry of entries) {
    const end = data.indexOf(10, offset), header = data.subarray(offset, end).toString().match(/^[a-f0-9]{40} blob (\d+)$/);
    assert(header, 'Objeto Git inválido');
    const size = +header[1], original = data.subarray(end + 1, end + 1 + size), path = entry[2];
    assert(!lstatSync(path).isSymbolicLink(), path);
    assert.equal(hash(readFileSync(path)), hash(original), `Entrada protegida alterada: ${path}`);
    offset = end + 1 + size + 1;
  }
  assert.deepEqual(JSON.parse(readFileSync('legal/registry.json')), { schemaVersion: 1, releases: [] });
  assert.deepEqual(JSON.parse(readFileSync('legal/releases.lock.json')), { schemaVersion: 2, files: {}, records: {} });
  assert.deepEqual(JSON.parse(readFileSync('src/config/legal-current.json')), { terminos: null, aviso_privacidad: null });
  return entries.length;
}
