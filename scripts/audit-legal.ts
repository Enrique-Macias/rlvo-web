import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DOCUMENTS, canonicalSha256 } from '../src/legal/canonical.ts';
import { getDraftEntry, getLegalEntry, loadLegalState, technicalManifest } from '../src/legal/registry.ts';

const state = loadLegalState();
function verifyDownload(stem: string, bytes: Buffer, filename: string) {
  const served = readFileSync(`dist${stem}.md`);
  assert(served.equals(bytes), `${stem}: descarga diferente de la fuente canónica`);
  assert.equal(readFileSync(`dist${stem}.sha256`, 'utf8'), `${canonicalSha256(served)}  ${filename}.md\n`);
}
for (const document of DOCUMENTS) {
  verifyDownload(`/legal/borradores/${document}`, getDraftEntry(document).bytes, document);
  const entry = getLegalEntry(document);
  const html = readFileSync(`dist/${document}.html`, 'utf8');
  assert(html.includes('name="robots" content="noindex, follow"'), `${document}: política de indexación alterada`);
  if (entry.draft) {
    assert(html.includes('Borrador pendiente de revisión jurídica'));
    assert.equal((html.match(/\[\[POR CONFIRMAR:/g) ?? []).length, (entry.bytes.toString().match(/\[\[POR CONFIRMAR:/g) ?? []).length);
    assert(html.includes(`/legal/borradores/${document}.md`));
  } else {
    const historical = readFileSync(`dist/${document}/${entry.version}.html`, 'utf8');
    assert(html.includes(`href="https://www.rlvo.com.mx/${document}/${entry.version}"`));
    assert(historical.includes(`href="https://www.rlvo.com.mx/${document}/${entry.version}"`));
    assert(!html.includes('Borrador pendiente de revisión jurídica'));
  }
}
for (const release of state.releases) {
  const entry = getLegalEntry(release.document, release.version);
  verifyDownload(`/legal/${release.document}/${release.version}`, entry.bytes, release.version);
  const html = readFileSync(`dist/${release.document}/${release.version}.html`, 'utf8');
  assert(html.includes(`href="${release.url}"`), 'Canonical histórico incorrecto');
  assert(html.includes(`/legal/${release.document}/${release.version}.md`));
  assert(!html.includes('Borrador pendiente de revisión jurídica'));
}
assert.deepEqual(JSON.parse(readFileSync('dist/legal/manifest.json', 'utf8')), technicalManifest());
const versionedHtml = readdirSync('dist', { recursive: true }).filter((file) => typeof file === 'string' && /^(?:terminos|privacidad)\/.*\.html$/.test(file));
assert.equal(versionedHtml.length, state.releases.length, 'Se generaron versiones no registradas');
assert.equal(readFileSync('dist/_headers', 'utf8'), readFileSync('public/_headers', 'utf8'));
console.log(`Artefactos legales: descargas byte por byte, checksums, alias, canonical y manifiesto verificados; ${state.releases.length} releases.`);
