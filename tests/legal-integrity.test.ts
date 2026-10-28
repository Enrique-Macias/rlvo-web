import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DOCUMENTS, assertCanonical, assertPublishable, canonicalSha256, normalizeCanonical,
  parseCanonicalDocument, sha256, verifyAppendOnly, verifyHistoricalFiles,
} from '../src/legal/canonical.ts';
import { assertVersionSlug, getLegalEntry, getReleaseReferences, loadLegalState, recordDigest, releaseId, releaseSourcePath, parseCurrent, parseReleaseRegistry, technicalManifest } from '../src/legal/registry.ts';
import { renderLegalBody } from '../src/legal/render.ts';

const baseline = JSON.parse(readFileSync('tests/fixtures/legal-migration.json', 'utf8')) as {
  documents: Record<string, { textSha256: string; links: string[]; sectionIds: string[]; header: { title: string; intro: string; date: string } }>;
};
const decode = (text: string) => text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, value: string) => {
  if (value.startsWith('#x')) return String.fromCodePoint(Number.parseInt(value.slice(2), 16));
  if (value.startsWith('#')) return String.fromCodePoint(Number(value.slice(1)));
  return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[value] ?? entity;
});
const visibleText = (html: string) => decode(html
  .replace(/<\/?(?:section|h[123]|p|li|ul|ol|div|br)\b[^>]*>/g, ' ')
  .replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

test('SHA-256 coincide con el vector estándar abc; no es un documento ni un hash de PL-016', () => {
  assert.equal(sha256(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('normalización explícita UTF-8/NFC/LF; determinista e idempotente', () => {
  const input = Buffer.from('\uFEFFCaf\u0065\u0301  \r\nTexto\t\r\n\r\n');
  const normalized = normalizeCanonical(input);
  assert.equal(normalized.toString(), 'Café\nTexto\n');
  assert.deepEqual(normalizeCanonical(normalized), normalized);
  assert.throws(() => canonicalSha256(input), /Bytes no canónicos/);
});

for (const [name, bytes] of [
  ['BOM', Buffer.from('\uFEFFTexto\n')], ['CRLF', Buffer.from('Texto\r\n')],
  ['NFD', Buffer.from('Cafe\u0301\n')], ['espacios finales', Buffer.from('Texto \n')],
  ['sin LF final', Buffer.from('Texto')], ['varios LF finales', Buffer.from('Texto\n\n')],
  ['UTF-8 inválido', Buffer.from([0xc3, 0x28])], ['NUL', Buffer.from('Texto\u0000\n')],
] as const) {
  test(`verificación estricta rechaza ${name} sin modificar los bytes recibidos`, () => {
    const original = Buffer.from(bytes);
    assert.throws(() => assertCanonical(bytes));
    assert.deepEqual(bytes, original);
  });
}

for (const document of DOCUMENTS) {
  test(`${document}: alias conserva un borrador, sus marcadores y el contenido aprobado para migración`, async () => {
    const entry = getLegalEntry(document);
    assert.equal(entry.version, null);
    assert.equal(entry.draft, true);
    assert.equal(entry.sha256, canonicalSha256(entry.bytes));
    assert.equal((entry.bytes.toString().match(/\[\[POR CONFIRMAR:/g) ?? []).length, document === 'terminos' ? 5 : 13);
    assert.throws(() => assertPublishable(entry.bytes), /borrador/i);
    const html = await renderLegalBody(entry);
    const expected = baseline.documents[document];
    assert.deepEqual({ title: entry.title, intro: entry.intro, date: entry.date }, expected.header);
    assert.equal(sha256(Buffer.from(visibleText(html))), expected.textSha256, 'El texto jurídico renderizado cambió');
    assert.deepEqual([...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => decode(match[1])), expected.links);
    assert.deepEqual([...html.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map((match) => match[1]), expected.sectionIds);
    assert(!/<script\b|\{#[a-z]/.test(html));
    assert.throws(() => getLegalEntry(document, 'v1.0'), /inexistente/);
  });
}

test('registro real vacío, punteros explícitos nulos y manifiesto estático compatible con el contrato', () => {
  assert.deepEqual(getReleaseReferences(), []);
  const manifest = technicalManifest();
  assert.equal(manifest.format, 'rlvo-legal-manifest');
  assert.equal(manifest.hashAlgorithm, 'SHA-256');
  assert.deepEqual(manifest.current, { terminos: null, aviso_privacidad: null });
  assert.deepEqual(manifest.releases, []);
  assert.throws(() => parseCurrent({ terminos: 'inexistente', aviso_privacidad: null }, []), /sin release/);
  assert.throws(() => parseReleaseRegistry({ schemaVersion: 1, releases: [], columna_supuesta: true }), /inesperados/);
});

test('control negativo: ningún borrador puede convertirse en release aunque tenga metadata y lock coherentes', () => {
  const root = mkdtempSync(join(tmpdir(), 'rlvo-legal-negative-'));
  try {
    mkdirSync(join(root, 'legal'), { recursive: true });
    mkdirSync(join(root, 'src/config'), { recursive: true });
    const bytes = getLegalEntry('terminos').bytes;
    // Metadata exclusivamente técnica en /tmp; no representa aprobación ni genera páginas.
    const row = { tipo: 'terminos', version: 'solo-prueba-negativa', vigente_desde: '2020-01-01T00:00:00Z',
      url: 'https://www.rlvo.com.mx/terminos/solo-prueba-negativa', contenido_sha256: canonicalSha256(bytes) };
    const [entry] = parseReleaseRegistry({ schemaVersion: 1, releases: [row] });
    const path = releaseSourcePath(entry);
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), bytes);
    writeFileSync(join(root, 'legal/registry.json'), JSON.stringify({ schemaVersion: 1, releases: [row] }));
    writeFileSync(join(root, 'legal/releases.lock.json'), JSON.stringify({ schemaVersion: 2,
      files: { [path]: { sha256: canonicalSha256(bytes), bytes: bytes.length } }, records: { [releaseId(entry)]: recordDigest(entry) } }));
    writeFileSync(join(root, 'src/config/legal-current.json'), JSON.stringify({ terminos: null, aviso_privacidad: null }));
    assert.throws(() => loadLegalState(root), /borrador/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

for (const version of ['staging-prueba', 'v-staging-prueba', '../otro', 'v1/otro', '%2e%2e', '']) {
  test(`identificador rechazado: ${version || '(vacío)'}`, () => assert.throws(() => assertVersionSlug(version)));
}

test('el parser rechaza HTML, interpolaciones y cambios que rompan anchors', () => {
  const bytes = getLegalEntry('terminos').bytes;
  for (const change of [
    (text: string) => text.replace('## Servicio y elegibilidad {#servicio}', '## Servicio y elegibilidad'),
    (text: string) => text.replace('{#cuenta}', '{#servicio}'),
    (text: string) => text.replace('{#servicio}', '{#inicio}'),
    (text: string) => text + '\n<script>alert(1)</script>\n',
    (text: string) => text + '\n{site.brand}\n',
  ]) assert.throws(() => parseCanonicalDocument(Buffer.from(change(bytes.toString()))));
});

test('el renderer rechaza protocolos activos y bloques de código', async () => {
  const entry = getLegalEntry('terminos');
  await assert.rejects(() => renderLegalBody({ ...entry, body: entry.body.replace('mailto:soporte@rlvo.com.mx', 'javascript:alert(1)') }));
  await assert.rejects(() => renderLegalBody({ ...entry, body: entry.body + '\n    código no admitido\n' }));
});

// Material técnico en memoria: no representa releases jurídicamente aprobados.
const fixture = Buffer.from('Material exclusivo de una prueba de integridad.\n');
const original = { sha256: sha256(fixture), bytes: fixture.length };
const history = { 'fixture.md': original };

test('histórico idéntico conserva su huella', () => {
  verifyHistoricalFiles(history, new Map([['fixture.md', fixture]]));
  verifyAppendOnly(history, { ...history });
});

test('control negativo: modificación de bytes históricos', () => {
  assert.throws(() => verifyHistoricalFiles(history, new Map([['fixture.md', Buffer.from('Material alterado.\n')]])), /modificado/);
});

test('control negativo: eliminación o renombrado de un histórico', () => {
  assert.throws(() => verifyHistoricalFiles(history, new Map()), /eliminado/);
  assert.throws(() => verifyHistoricalFiles(history, new Map([['otro.md', fixture]])), /eliminado/);
});

test('control negativo: reescribir también el lock no permite cambiar un histórico frente al baseline', () => {
  const changed = Buffer.from('Material alterado.\n');
  const rewritten = { 'fixture.md': { sha256: sha256(changed), bytes: changed.length } };
  assert.throws(() => verifyAppendOnly(history, rewritten), /entrada original/);
  assert.throws(() => verifyAppendOnly(history, {}), /entrada original/);
});

test('control append-only permite agregar un archivo técnico sin tocar las entradas anteriores', () => {
  verifyAppendOnly(history, { ...history, 'otro.md': original });
});
