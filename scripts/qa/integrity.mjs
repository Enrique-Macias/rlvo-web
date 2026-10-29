import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedPath = p => /^(?:src\/content\/legal(?:\/|\.ts)|legal\/|src\/config\/(?:site\.ts|legal-current\.json)|docs\/(?:PL-016-WEB-INTEGRATION-CONTRACT|LEGAL_FACTS)\.md|src\/pages\/eliminar-cuenta\.astro|brand-reference\/|public\/(?:brand\/|screenshots\/|favicon\.svg)|src\/components\/CloudflareWebAnalytics\.astro|wrangler\.jsonc|scripts\/ci\/|scripts\/check-legal-baseline\.mjs|tests\/ci-|tests\/legal-|tests\/fixtures\/legal-migration\.json|\.github\/)/.test(p);
export function verifyProtectedFiles() {
  const entries = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD']).toString().split('\0').filter(Boolean)
    .map(line => line.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/s)).filter(m => m && protectedPath(m[2]));
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
