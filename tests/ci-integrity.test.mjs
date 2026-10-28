import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { INITIAL_BASELINE, assertCommit, captureInputs, assertInputsUnchanged } from '../scripts/ci/inputs.mjs';
import { gitInputs, gitBlob, verifyDraftPolicy, verifyHistoryWithTrustedChecker } from '../scripts/ci/legal-policy.mjs';
import { assertTrustReferences, verifyGitCandidate } from '../scripts/ci/trusted-legal.mjs';

const root = process.cwd(), baseline = gitInputs(root, INITIAL_BASELINE);
const checker = gitBlob(root, INITIAL_BASELINE, 'scripts/check-legal-baseline.mjs');
const clone = () => new Map([...baseline].map(([path, bytes]) => [path, Buffer.from(bytes)]));
function temporary(callback) {
  const directory = mkdtempSync(join(tmpdir(), 'rlvo-ci-unit-'));
  try {
    for (const [path, bytes] of baseline) { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), bytes); }
    for (const file of ['package.json', 'package-lock.json']) writeFileSync(join(directory, file), '{}\n');
    callback(directory);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
test('candidato inicial es un pin de prueba local, no implica protección remota', async () => {
  assert.deepEqual(verifyDraftPolicy(baseline, clone()), { releases: 0, markers: 23 });
  assert.deepEqual(await verifyGitCandidate(root, { baseline: INITIAL_BASELINE, base: INITIAL_BASELINE, candidate: INITIAL_BASELINE, protectedBaseline: INITIAL_BASELINE }), { releases: 0, markers: 23 });
});
test('baseline sin SHA, simbólico, abreviado o distinto del ref aprobado falla cerrado', () => {
  for (const value of [undefined, '', 'HEAD', 'main', INITIAL_BASELINE.slice(0, 7), '../main', INITIAL_BASELINE.toUpperCase()]) assert.throws(() => assertCommit(value));
  assert.throws(() => assertTrustReferences(root, { baseline: INITIAL_BASELINE, base: INITIAL_BASELINE, candidate: INITIAL_BASELINE, protectedBaseline: '0'.repeat(40) }), /no coincide/);
});
test('código del candidato no reemplaza el checker extraído del baseline', async () => {
  const candidate = clone();
  candidate.set('scripts/check-legal-baseline.mjs', Buffer.from('throw new Error("No debe ejecutarse código del PR");'));
  await verifyHistoryWithTrustedChecker(checker, baseline, candidate);
  assert(!gitInputs(root, INITIAL_BASELINE).has('scripts/check-legal-baseline.mjs'));
});
for (const path of ['src/content/legal/drafts/terminos.md', 'src/content/legal/drafts/privacidad.md', 'docs/PL-016-WEB-INTEGRATION-CONTRACT.md', 'src/pages/eliminar-cuenta.astro', 'src/content/legal.ts', 'src/config/site.ts']) {
  test(`política independiente bloquea una alteración aunque cambien los tests/scripts del PR: ${path}`, () => {
    const candidate = clone(); candidate.set(path, Buffer.from('Contenido alterado\n'));
    assert.throws(() => verifyDraftPolicy(baseline, candidate), /alterado/);
  });
}
test('eliminar un marcador conservando el resto del documento falla', () => {
  const candidate = clone(), path = 'src/content/legal/drafts/terminos.md';
  candidate.set(path, Buffer.from(candidate.get(path).toString().replace(/\[\[POR CONFIRMAR:[^\n]+/, 'Texto sin marcador')));
  assert.throws(() => verifyDraftPolicy(baseline, candidate), /alterado/);
});
test('no se permite registrar releases, reescribir lock, activar punteros ni añadir v1.0', () => {
  for (const [path, value] of [
    ['legal/registry.json', { schemaVersion: 1, releases: [{}] }],
    ['legal/releases.lock.json', { schemaVersion: 2, files: { alterado: {} }, records: {} }],
    ['src/config/legal-current.json', { terminos: 'v1.0', aviso_privacidad: null }],
  ]) {
    const candidate = clone(); candidate.set(path, Buffer.from(JSON.stringify(value)));
    assert.throws(() => verifyDraftPolicy(baseline, candidate), /drafts-only/);
  }
  const candidate = clone(); candidate.set('src/content/legal/releases/terminos/v1.0/document.md', Buffer.from('Solo control negativo en memoria\n'));
  assert.throws(() => verifyDraftPolicy(baseline, candidate), /añaden/);
});
test('tampoco se permite ocultar un release nuevo avanzando el baseline sin cambiar la política aprobada', () => {
  const changed = clone(); changed.set('legal/registry.json', Buffer.from('{"schemaVersion":1,"releases":[{}]}'));
  assert.throws(() => verifyDraftPolicy(changed, changed), /drafts-only/);
});
test('checker histórico real sigue detectando sustitución/eliminación y lock reescrito desde el wrapper aislado', async () => {
  // Datos exclusivamente técnicos en memoria: no es un release ni se genera una página.
  const path = 'src/content/legal/releases/terminos/prueba-unitaria/document.md';
  const bytes = Buffer.from('Solo material técnico de integridad.\n');
  const { digest } = await import('../scripts/ci/inputs.mjs');
  const old = clone(), next = clone();
  const lock = { schemaVersion: 2, files: { [path]: { sha256: digest(bytes), bytes: bytes.length } }, records: {} };
  old.set('legal/releases.lock.json', Buffer.from(JSON.stringify(lock)));
  next.set('legal/releases.lock.json', Buffer.from(JSON.stringify(lock))); next.set(path, bytes);
  await verifyHistoryWithTrustedChecker(checker, old, next);
  next.set(path, Buffer.from('Sustituido\n'));
  await assert.rejects(() => verifyHistoryWithTrustedChecker(checker, old, next), /alterados/);
  next.delete(path);
  await assert.rejects(() => verifyHistoryWithTrustedChecker(checker, old, next), /eliminado/);
  next.set('legal/releases.lock.json', baseline.get('legal/releases.lock.json'));
  await assert.rejects(() => verifyHistoryWithTrustedChecker(checker, old, next), /reescrito/);
});
test('snapshot no modifica inputs y acepta lecturas repetidas', () => temporary(directory => {
  const before = captureInputs(directory); assertInputsUnchanged(before, captureInputs(directory));
}));
test('snapshot detecta escrituras incluso con los mismos bytes', () => temporary(directory => {
  const path = 'src/content/legal/drafts/terminos.md', file = join(directory, path);
  // Timestamp anterior fijo: evita depender de la resolución temporal del filesystem del runner.
  utimesSync(file, new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'));
  const before = captureInputs(directory);
  writeFileSync(file, baseline.get(path));
  assert.throws(() => assertInputsUnchanged(before, captureInputs(directory)), /reescribió/);
}));
test('snapshot detecta adiciones, eliminaciones y symlinks en el árbol canónico', () => temporary(directory => {
  const before = captureInputs(directory), added = join(directory, 'src/content/legal/drafts/extra.md');
  writeFileSync(added, 'Control negativo\n'); assert.throws(() => assertInputsUnchanged(before, captureInputs(directory)));
  rmSync(added); rmSync(join(directory, 'src/content/legal/releases/.gitkeep'));
  assert.throws(() => assertInputsUnchanged(before, captureInputs(directory)));
  symlinkSync(join(directory, 'src/config/site.ts'), added);
  assert.throws(() => captureInputs(directory), /Symlink/);
}));

test('la referencia histórica no puede adelantarse a la base ni aceptar un candidato atrasado', () => {
  const branding = '4bf6120';
  const old = execFileSync('git', ['rev-parse', branding], { encoding: 'utf8' }).trim();
  assert.throws(() => assertTrustReferences(root, { baseline: INITIAL_BASELINE, base: old, candidate: INITIAL_BASELINE, protectedBaseline: INITIAL_BASELINE }));
  assert.throws(() => assertTrustReferences(root, { baseline: INITIAL_BASELINE, base: INITIAL_BASELINE, candidate: old, protectedBaseline: INITIAL_BASELINE }));
});
test('la entrada del job confiable rechaza ejecución fuera de su contexto antes de hacer fetch', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/ci/trusted-legal.mjs'], {
    env: { ...process.env, GITHUB_ACTIONS: 'false' }, stdio: 'pipe',
  }), error => error.stderr.toString().includes('Entrada reservada'));
});
