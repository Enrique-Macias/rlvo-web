import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DOCUMENTS } from '../src/legal/canonical.ts';
import { getLegalEntry, loadLegalState } from '../src/legal/registry.ts';

const state = loadLegalState();
execFileSync(process.execPath, ['scripts/check-legal-baseline.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
for (const document of DOCUMENTS) {
  const entry = getLegalEntry(document);
  console.log(`${document}: ${entry.draft ? 'borrador' : entry.version}, ${entry.bytes.length} bytes, SHA-256 ${entry.sha256}`);
}
const headers = readFileSync('public/_headers', 'utf8');
if (!headers.includes('/legal/*\n  X-Robots-Tag: noindex, follow')) throw new Error('Faltan headers legales de Workers Static Assets');
console.log(`Integridad legal: ${state.releases.length} releases. Contrato PL-016 38b6b73; sin acceso a Supabase.`);
