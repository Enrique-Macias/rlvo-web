import assert from 'node:assert/strict';
import { getDraftEntry, loadLegalState, technicalManifest } from '../src/legal/registry.ts';
import { DOCUMENTS } from '../src/legal/canonical.ts';

const [argument, ...extra] = process.argv.slice(2);
const origin = new URL(argument ?? 'http://127.0.0.1:4391');
if (extra.length || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('Uso: npm run test:legal:http -- http://127.0.0.1:<puerto> (solo vista previa local)');
}
const get = (path: string) => fetch(new URL(path, origin), { redirect: 'manual' });
for (const path of ['/', '/terminos', '/privacidad', '/soporte', '/contacto', '/eliminar-cuenta']) {
  const response = await get(path); assert.equal(response.status, 200, path);
}
for (const document of DOCUMENTS) {
  const entry = getDraftEntry(document);
  const response = await get(`/legal/borradores/${document}.md`); assert.equal(response.status, 200);
  assert(Buffer.from(await response.arrayBuffer()).equals(entry.bytes));
  const checksum = await get(`/legal/borradores/${document}.sha256`); assert.equal(checksum.status, 200);
  assert.equal(await checksum.text(), `${entry.sha256}  ${document}.md\n`);
}
const manifest = await get('/legal/manifest.json'); assert.equal(manifest.status, 200);
assert.deepEqual(await manifest.json(), technicalManifest());
const state = loadLegalState();
let missing = 0;
for (const document of DOCUMENTS) {
  for (const version of ['v1.0', 'staging-prueba', 'no-existe-auditoria']) {
    if (state.releases.some((entry) => entry.document === document && entry.version === version)) continue;
    for (const path of [`/${document}/${version}`, `/legal/${document}/${version}.md`, `/legal/${document}/${version}.sha256`]) {
      const response = await get(path); assert.equal(response.status, 404, `${path} debe responder 404 real`); missing++;
    }
  }
}
console.log(`HTTP local: seis páginas públicas 200, descargas exactas, manifiesto correcto y ${missing} versiones inexistentes 404; sin redirects ni fallback SPA.`);
