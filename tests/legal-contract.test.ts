import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { assertCanonical, canonicalSha256, sha256, normalizeCanonical } from '../src/legal/canonical.ts';
import { ACTION_BY_TYPE, TYPE_BY_DOCUMENT, assertVersionSlug, timestampMicros, hexToBytea, byteaToHex } from '../src/legal/contract.ts';
import { verifyArchivedCopy } from '../src/legal/archive.ts';
import { parseReleaseRegistry, parseHistory, parseCurrent, recordDigest, verifyReleaseLock, type ReleaseLock } from '../src/legal/registry.ts';
import { verifyTrustedBaseline } from '../scripts/check-legal-baseline.mjs';

// Vectores del contrato: datos de prueba, nunca releases ni hashes del HTML de STAGING.
const vector = Buffer.from('Términos de uso\nVersión de prueba\n');
const vectorHash = 'dcba0f0dea38bbc87ee70d825dc8966f16c232e64d8ce8c846f799ab76e006fb';
test('vector A de PL-016: hash de bytes, no es un archivo canónico', () => {
  const bytes = Buffer.from('local-prueba');
  assert.equal(bytes.length, 12);
  assert.equal(sha256(bytes), '27df2ac49d1fae51bc8cbf0d88f5354176b5290a5a5907d11ca8d2fd2fcf33b5');
  assert.throws(() => assertCanonical(bytes));
});
test('vector C de PL-016 coincide en Node y shasum; 36 bytes NFC', () => {
  assert.equal(vector.length, 36); assert.equal(canonicalSha256(vector), vectorHash);
  assert.equal(execFileSync('shasum', ['-a', '256'], { input: vector, encoding: 'utf8' }).split(' ')[0], vectorHash);
});
for (const [name, text, expected] of [
  ['NFD', vector.toString().normalize('NFD'), '424b86a79959b6c7d9a48d2d3568cca86516940fd5670fc148129efbbee35169'],
  ['CRLF', vector.toString().replaceAll('\n', '\r\n'), '54bc521fd916ecdb4b227423f2c62873314028530587fd4691252efc783989b7'],
  ['sin LF', vector.toString().slice(0, -1), 'a56c3ca3e975a1f7267a64a9fbd4c1e6eeccf91b5cc9f1184b88b90f6cb0eec1'],
]) test(`vector negativo del contrato: ${name}`, () => {
  const bytes = Buffer.from(text); assert.equal(sha256(bytes), expected); assert.notEqual(expected, vectorHash);
  assert.throws(() => assertCanonical(bytes)); assert.deepEqual(normalizeCanonical(bytes), vector);
});
test('hex y bytea representan exactamente los mismos 32 bytes', () => {
  assert.equal(Buffer.from(vectorHash, 'hex').length, 32);
  assert.equal(hexToBytea(vectorHash), `\\x${vectorHash}`);
  assert.equal(byteaToHex(hexToBytea(vectorHash)), vectorHash);
  for (const bad of ['aa', 'g'.repeat(64), vectorHash.toUpperCase()]) assert.throws(() => hexToBytea(bad));
  assert.throws(() => byteaToHex(vectorHash));
});
test('tipos y acciones reales; presentar privacidad no equivale a aceptarla', () => {
  assert.deepEqual(TYPE_BY_DOCUMENT, { terminos: 'terminos', privacidad: 'aviso_privacidad' });
  assert.deepEqual(ACTION_BY_TYPE, { terminos: 'aceptado', aviso_privacidad: 'presentado' });
});
test('CHECK exacto de version conserva segmentos válidos, incluso puntos o guiones repetidos', () => {
  for (const version of ['v1.0', 'a', '1', 'a..--.', 'a'.repeat(40)]) assert.doesNotThrow(() => assertVersionSlug(version));
  for (const version of ['a'.repeat(41), '-a', '.a', 'V1', 'v_1', 'a/b', 'á', 'a\n']) assert.throws(() => assertVersionSlug(version));
});
test('vigente_desde compara instantes con zona y precisión de microsegundos', () => {
  assert.equal(timestampMicros('2026-10-27T00:00:00.000001Z'), timestampMicros('2026-10-26T18:00:00.000001-06:00'));
  assert.equal(timestampMicros('2026-10-27T00:00:00.000002Z') - timestampMicros('2026-10-27T00:00:00.000001Z'), 1n);
  for (const value of ['2026-02-30T00:00:00Z', '2026-10-27', '2026-10-27T00:00:00', '2026-10-27T24:00:00Z', '2026-10-27T00:00:00.0000001Z']) assert.throws(() => timestampMicros(value));
});
// Registros técnicos solo en memoria para probar restricciones. No contienen texto legal aprobado.
const row = { tipo: 'terminos', version: 'prueba-tecnica', vigente_desde: '2026-10-27T00:00:00Z',
  url: 'https://www.rlvo.com.mx/terminos/prueba-tecnica', contenido_sha256: vectorHash };
const parse = (releases: unknown[]) => parseReleaseRegistry({ schemaVersion: 1, releases });
test('registro acepta solo columnas reales; omite created_at que asigna el backend', () => {
  assert.equal(parse([row])[0].document, 'terminos');
  assert.throws(() => parse([{ ...row, created_at: row.vigente_desde }]), /inesperados/);
  assert.throws(() => parse([{ ...row, tipo: 'privacidad' }]), /desconocido/);
  assert.throws(() => parse([{ ...row, contenido_sha256: hexToBytea(vectorHash) }]), /hexadecimal/);
});
test('PK y UNIQUE se verifican incluyendo zonas equivalentes; tipos distintos son independientes', () => {
  assert.throws(() => parse([row, row]), /PK/);
  assert.throws(() => parse([row, { ...row, version: 'otra-prueba', url: 'https://www.rlvo.com.mx/terminos/otra-prueba', vigente_desde: '2026-10-26T18:00:00-06:00' }]), /UNIQUE/);
  assert.equal(parse([row, { ...row, tipo: 'aviso_privacidad', url: 'https://www.rlvo.com.mx/privacidad/prueba-tecnica' }]).length, 2);
});
test('URL debe mantener origen aprobado, ruta y segmento version exactos', () => {
  for (const url of ['http://www.rlvo.com.mx/terminos/prueba-tecnica', 'https://rlvo.com.mx/terminos/prueba-tecnica', 'https://www.rlvo.com.mx/terminos/otra', row.url + '?v=1', row.url + '/']) assert.throws(() => parse([{ ...row, url }]), /URL/);
});
test('puntero exige release y nunca anticipa vigente_desde; no selecciona versiones automáticamente', () => {
  const releases = parse([row]);
  assert.throws(() => parseCurrent({ terminos: row.version, aviso_privacidad: null }, releases, timestampMicros('2026-10-26T00:00:00Z')), /anticipado/);
  assert.equal(parseCurrent({ terminos: row.version, aviso_privacidad: null }, releases, timestampMicros(row.vigente_desde)).terminos, row.version);
  assert.deepEqual(parseCurrent({ terminos: null, aviso_privacidad: null }, releases), { terminos: null, aviso_privacidad: null });
});
const path = 'src/content/legal/releases/terminos/prueba-tecnica/document.md';
const lock: ReleaseLock = { schemaVersion: 2, files: { [path]: { sha256: vectorHash, bytes: vector.length } }, records: { 'terminos/prueba-tecnica': recordDigest(parse([row])[0]) } };
test('lock protege bytes y metadata del identificador; no depende del orden de las claves', () => {
  assert.deepEqual(parseHistory(lock), lock); verifyReleaseLock(lock, structuredClone(lock));
  assert.equal(recordDigest(parse([row])[0]), recordDigest({ ...parse([row])[0] }));
  for (const mutation of [{ ...row, vigente_desde: '2026-10-28T00:00:00Z' }, { ...row, url: row.url + '-otra' }, { ...row, contenido_sha256: 'a'.repeat(64) }]) {
    const next = structuredClone(lock); next.records['terminos/prueba-tecnica'] = recordDigest(mutation as typeof row & { tipo: 'terminos' });
    assert.throws(() => verifyReleaseLock(lock, next), /reutilizado/);
  }
  assert.throws(() => verifyReleaseLock(lock, { ...lock, records: {} }), /eliminado/);
});
test('checker aislado contrasta metadata, lock y bytes con el baseline protegido', () => {
  const registry = { releases: [row] };
  verifyTrustedBaseline(lock, lock, registry, () => vector);
  assert.throws(() => verifyTrustedBaseline(lock, lock, registry, () => Buffer.from('Cambio\n')), /Bytes/);
  assert.throws(() => verifyTrustedBaseline(lock, lock, { releases: [] }, () => vector), /eliminado/);
  const altered = { ...row, vigente_desde: '2026-10-28T00:00:00Z' };
  const rewritten = structuredClone(lock); rewritten.records['terminos/prueba-tecnica'] = recordDigest(altered as typeof row & { tipo: 'terminos' });
  assert.throws(() => verifyTrustedBaseline(lock, rewritten, { releases: [altered] }, () => vector), /reutilizado/);
  assert.throws(() => verifyTrustedBaseline(lock, { ...lock, files: {} }, registry, () => vector), /eliminado/);
});
test('comparación de copia archivada bloquea cualquier discrepancia o normalización implícita', () => {
  assert.deepEqual(verifyArchivedCopy(vector, Buffer.from(vector), vectorHash), { sha256: vectorHash, bytea: `\\x${vectorHash}`, bytes: 36 });
  assert.throws(() => verifyArchivedCopy(vector, Buffer.from('Otro texto\n'), vectorHash), /Discrepancia/);
  assert.throws(() => verifyArchivedCopy(vector, vector, '0'.repeat(64)), /Discrepancia/);
  assert.throws(() => verifyArchivedCopy(vector, Buffer.from(vector.toString().normalize('NFD')), vectorHash), /canónicos/);
});
test('CI falla cerrado sin SHA protegido; referencia explícita sin lock tampoco permite bootstrap', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/check-legal-baseline.mjs'], { env: { ...process.env, CI: 'true', LEGAL_BASELINE_REF: '' }, stdio: 'pipe' }));
  assert.throws(() => execFileSync(process.execPath, ['scripts/check-legal-baseline.mjs', '--baseline-ref', '4bf6120'], { stdio: 'pipe' }));
});
