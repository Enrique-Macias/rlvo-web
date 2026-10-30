import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectControls, verifyControls, verifyCurrentControls, POLICY_PATH, REPOSITORY, MAX_AUTHORIZATION_MS } from '../scripts/ci/control-policy.mjs';

// Objetos de prueba sin checkout, ramas, refs o commits en rlvo-web. Nunca hay red.
const root = mkdtempSync(join(tmpdir(), 'rlvo-ci-policy-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
const env = { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
const git = (args, input) => execFileSync('git', ['-C', root, '-c', 'core.hooksPath=/dev/null', ...args],
  { env, input, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
git(['init', '--quiet']);
function makeCommit(changes, parent) {
  git(parent ? ['read-tree', parent] : ['read-tree', '--empty']);
  for (const [path, value] of Object.entries(changes)) {
    if (value === null) { git(['update-index', '--force-remove', '--', path]); continue; }
    const entry = typeof value === 'string' || Buffer.isBuffer(value) ? { bytes: value } : value;
    const oid = entry.oid ?? git(['hash-object', '-w', '--stdin'], entry.bytes);
    git(['update-index', '--add', '--cacheinfo', `${entry.mode ?? '100644'},${oid},${path}`]);
  }
  const tree = git(['write-tree']);
  return git(['commit-tree', tree, ...(parent ? ['-p', parent] : [])], 'Fixture aislado de CI, sin publicación\n');
}
const policyBytes = readFileSync(new URL('../ci/control-policy.json', import.meta.url));
const policy = JSON.parse(policyBytes);
const checkerBytes = readFileSync(new URL('../scripts/ci/control-policy.mjs', import.meta.url));
const base = makeCommit({
  [POLICY_PATH]: policyBytes,
  '.github/workflows/web-ci.yml': 'name: Web fixture\non: pull_request\n',
  '.github/workflows/legal-trust.yml': 'name: Trust fixture\non: pull_request_target\n',
  'scripts/ci/control-policy.mjs': checkerBytes,
  'tests/ci-fixture.test.mjs': '/* fixture */\n',
  'package.json': '{}\n', 'astro.config.mjs': 'export default {};\n',
  'src/content/legal/drafts/terminos.md': 'Fixture técnico sin valor jurídico.\n',
  'legal/registry.json': '{"schemaVersion":1,"releases":[]}\n',
  'legal/releases.lock.json': '{"schemaVersion":2,"files":{},"records":{}}\n',
  'src/config/legal-current.json': '{"terminos":null,"aviso_privacidad":null}\n',
  'docs/PL-016-WEB-INTEGRATION-CONTRACT.md': 'Contrato de fixture técnico\n',
  'src/pages/index.astro': '<h1>Fixture</h1>\n',
});
const now = Date.parse('2026-10-29T20:00:00.000Z');
const context = headSha => ({ root, repository: REPOSITORY, pullRequest: 7, baseSha: base, headSha });
const changed = (path, value) => makeCommit({ [path]: value }, base);
const errorCode = code => error => error?.name === 'ControlPolicyError' && error.code === code && error.message.startsWith(`${code}:`);
function authorization(head, extra = {}) {
  const inspected = inspectControls(context(head));
  return { schemaVersion: 1, repository: REPOSITORY, pullRequest: 7, baseSha: base, headSha: head,
    changesDigest: inspected.changesDigest, authorizationId: 'fixture-maintenance-1',
    issuedAt: '2026-10-29T19:59:00.000Z', expiresAt: '2026-10-29T21:00:00.000Z', ...extra };
}
const criticalHead = changed('.github/workflows/web-ci.yml', 'name: Changed fixture\n');

test('sin cambios: control válido, sin aprobación de merge y verificación jurídica aún obligatoria', () => {
  const result = verifyControls({ ...context(base), now });
  assert.equal(result.controlIntegrity, 'unchanged');
  assert.equal(result.mergeApproval, false);
  assert.equal(result.legalVerificationRequired, true);
  assert.equal(result.legalInputsUnchanged, true);
});
test('cambio normal de producción pasa sin autorización', () => {
  assert.equal(verifyControls({ ...context(changed('src/pages/index.astro', '<h1>Otro fixture</h1>\n')), now }).controlIntegrity, 'unchanged');
});
test('autorización vieja o malformada no bloquea cambios sin diferencias críticas', () => {
  assert.equal(verifyControls({ ...context(base), now, authorization: 'JSON obsoleto' }).controlIntegrity, 'unchanged');
});
test('inspección informativa identifica cambio y digest pero no aprueba merge', () => {
  const result = inspectControls(context(criticalHead));
  assert.equal(result.mergeApproval, false);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].path, '.github/workflows/web-ci.yml');
  assert.match(result.changesDigest, /^[a-f0-9]{64}$/);
});
test('digest reproducible con orden/claves/UTF-8/LF definidos, calculado independientemente', () => {
  const first = inspectControls(context(criticalHead));
  const second = inspectControls(context(criticalHead));
  assert.deepEqual(first, second);
  const input = { schemaVersion: 1, repository: REPOSITORY, pullRequest: 7, baseSha: base, headSha: criticalHead,
    policySha256: createHash('sha256').update(policyBytes).digest('hex'), changes: first.changes };
  assert.equal(first.changesDigest, createHash('sha256').update(Buffer.from(JSON.stringify(input) + '\n')).digest('hex'));
  assert.equal(first.changes[0].after.sha256, createHash('sha256').update('name: Changed fixture\n').digest('hex'));
});
test('cambio crítico sin autorización falla por CI_AUTH_REQUIRED', () => {
  assert.throws(() => verifyControls({ ...context(criticalHead), now }), errorCode('CI_AUTH_REQUIRED'));
});
test('autorización externa exacta permite cambio crítico sin aprobar jurídicamente', () => {
  const result = verifyControls({ ...context(criticalHead), now, authorization: JSON.stringify(authorization(criticalHead)) });
  assert.equal(result.controlIntegrity, 'authorized');
  assert.equal(result.authorization.authorizationId, 'fixture-maintenance-1');
  assert.equal(result.legalVerificationRequired, true);
  assert.equal(result.mergeApproval, false);
});
test('retirar autorización rechaza nueva evaluación; no revoca resultado anterior', () => {
  const input = { ...context(criticalHead), now };
  const previous = verifyControls({ ...input, authorization: authorization(criticalHead) });
  assert.throws(() => verifyControls(input), errorCode('CI_AUTH_REQUIRED'));
  assert.equal(previous.controlIntegrity, 'authorized');
});
test('misma autorización puede reevaluar el mismo commit; no se afirma consumo de un solo uso', () => {
  const input = { ...context(criticalHead), now, authorization: authorization(criticalHead) };
  assert.deepEqual(verifyControls(input), verifyControls(input));
});
for (const [field, value] of [
  ['repository', 'otro/repositorio'], ['pullRequest', 8], ['pullRequest', '7'],
  ['baseSha', 'a'.repeat(40)], ['headSha', 'b'.repeat(40)],
]) test(`autorización vinculada a otro ${field} (${typeof value}) se rechaza por binding`, () => {
  assert.throws(() => verifyControls({ ...context(criticalHead), now,
    authorization: authorization(criticalHead, { [field]: value }) }), errorCode('CI_AUTH_BINDING'));
});
test('digest diferente con autorización válida en los demás campos alcanza CI_AUTH_DIGEST', () => {
  assert.throws(() => verifyControls({ ...context(criticalHead), now,
    authorization: authorization(criticalHead, { changesDigest: '0'.repeat(64) }) }), errorCode('CI_AUTH_DIGEST'));
});
for (const [label, value] of [
  ['JSON inválido', '{'], ['campos adicionales', { ...authorization(criticalHead), allowLegal: true }],
  ['campo ausente', { ...authorization(criticalHead), authorizationId: undefined }],
  ['versión inválida', authorization(criticalHead, { schemaVersion: 2 })],
  ['digest abreviado', authorization(criticalHead, { changesDigest: 'abc' })],
]) test(`schema de autorización: ${label}`, () => {
  assert.throws(() => verifyControls({ ...context(criticalHead), now, authorization: JSON.stringify(value) }), errorCode('CI_AUTH_SCHEMA'));
});
for (const [label, extra, expected] of [
  ['caducada', { issuedAt: '2026-10-29T18:00:00.000Z', expiresAt: '2026-10-29T19:00:00.000Z' }, 'CI_AUTH_EXPIRED'],
  ['límite exacto de caducidad', { expiresAt: '2026-10-29T20:00:00.000Z' }, 'CI_AUTH_EXPIRED'],
  ['emisión futura', { issuedAt: '2026-10-29T20:01:00.000Z' }, 'CI_AUTH_NOT_YET_VALID'],
  ['TTL excesivo', { expiresAt: '2026-10-31T21:00:00.000Z' }, 'CI_AUTH_TIME'],
  ['ventana invertida', { expiresAt: '2026-10-29T19:00:00.000Z' }, 'CI_AUTH_TIME'],
  ['fecha sin zona', { issuedAt: '2026-10-29T19:59:00.000' }, 'CI_AUTH_TIME'],
  ['fecha inexistente', { issuedAt: '2026-02-30T19:59:00.000Z' }, 'CI_AUTH_TIME'],
]) test(`tiempo: ${label}; metadata restante y digest correctos`, () => {
  assert.throws(() => verifyControls({ ...context(criticalHead), now,
    authorization: authorization(criticalHead, extra) }), errorCode(expected));
});
test('TTL máximo de 24 horas es aceptado', () => {
  const result = verifyControls({ ...context(criticalHead), now, authorization: authorization(criticalHead,
    { issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + MAX_AUTHORIZATION_MS).toISOString() }) });
  assert.equal(result.controlIntegrity, 'authorized');
});
test('nuevo head invalida autorización aunque repita el árbol y digest de contenido', () => {
  const next = makeCommit({}, criticalHead);
  assert.throws(() => verifyControls({ ...context(next), now, authorization: authorization(criticalHead) }), errorCode('CI_AUTH_BINDING'));
});
test('cambio de base invalida la autorización', () => {
  const intermediate = changed('README.md', 'Fixture intermedio\n');
  const next = makeCommit({ '.github/workflows/web-ci.yml': 'name: Changed fixture\n' }, intermediate);
  const auth = authorization(next);
  assert.throws(() => verifyControls({ ...context(next), baseSha: intermediate, now, authorization: auth }), errorCode('CI_AUTH_BINDING'));
});
test('autorización de un PR no aprueba cambios críticos adicionales', () => {
  const next = makeCommit({ 'package.json': '{"scripts":{}}\n' }, criticalHead);
  assert.throws(() => verifyControls({ ...context(next), now, authorization: authorization(criticalHead) }), errorCode('CI_AUTH_BINDING'));
});
for (const [label, changes] of [
  ['eliminación', { '.github/workflows/web-ci.yml': null }],
  ['nuevo workflow suplantador', { '.github/workflows/impostor.yml': 'name: legal-integrity\n' }],
  ['renombrado', { '.github/workflows/web-ci.yml': null, '.github/workflows/renamed.yml': 'name: Web fixture\non: pull_request\n' }],
  ['cambio de modo', { 'scripts/ci/control-policy.mjs': { bytes: checkerBytes, mode: '100755' } }],
  ['nuevo archivo reservado', { '.npmrc': 'ignore-scripts=false\n' }],
  ['test nuevo sensible', { 'tests/ci-added.test.mjs': '/* otro fixture */\n' }],
  ['cambio de pruebas', { 'tests/ci-fixture.test.mjs': '/* omitido */\n' }],
  ['checker y tests simultáneos', { 'scripts/ci/control-policy.mjs': 'throw new Error("no ejecutar");\n', 'tests/ci-fixture.test.mjs': '/* omitido */\n' }],
  ['job skipped', { '.github/workflows/web-ci.yml': 'jobs:\n  web:\n    name: web-quality\n    if: false\n' }],
  ['job con continue-on-error', { '.github/workflows/web-ci.yml': 'jobs:\n  web:\n    continue-on-error: true\n' }],
  ['neutral o salida vacía', { '.github/workflows/web-ci.yml': 'jobs:\n  web:\n    steps: []\n' }],
]) test(`diferencia crítica no autorizada: ${label}`, () => {
  const head = makeCommit(changes, base);
  assert.throws(() => verifyControls({ ...context(head), now }), errorCode('CI_AUTH_REQUIRED'));
});
test('rename aparece como eliminación más adición; cambios ordenados por ruta', () => {
  const head = makeCommit({ '.github/workflows/web-ci.yml': null, '.github/workflows/renamed.yml': 'mismo propósito\n' }, base);
  const result = inspectControls(context(head));
  assert.deepEqual(result.changes.map(c => c.path), ['.github/workflows/renamed.yml', '.github/workflows/web-ci.yml']);
  assert.equal(result.changes[0].before, null); assert.equal(result.changes[1].after, null);
});
for (const [label, entry] of [
  ['symlink', { mode: '120000', bytes: '/tmp/no-leer' }],
  ['gitlink', { mode: '160000', oid: base }],
]) test(`tipos estructurales: ${label} protegido siempre rechazado`, () => {
  const head = changed('scripts/ci/control-policy.mjs', entry);
  assert.throws(() => inspectControls(context(head)), errorCode('CI_ENTRY_TYPE'));
  assert.throws(() => verifyControls({ ...context(head), now, authorization: '{}' }), errorCode('CI_ENTRY_TYPE'));
});
test('symlink en ancestro de ruta reservada no evade el scope', () => {
  const head = makeCommit({ 'tests/ci-fixture.test.mjs': null, tests: { mode: '120000', bytes: '/tmp/otro' } }, base);
  assert.throws(() => inspectControls(context(head)), errorCode('CI_ENTRY_TYPE'));
});
for (const path of ['legal/registry.json', 'legal/releases.lock.json', 'src/config/legal-current.json',
  'src/content/legal/drafts/terminos.md', 'docs/PL-016-WEB-INTEGRATION-CONTRACT.md']) {
  test(`autorización exacta no permite alterar fuente jurídica: ${path}`, () => {
    const head = makeCommit({ [path]: 'Fixture alterado\n', '.github/workflows/web-ci.yml': 'cambio autorizado\n' }, base);
    assert.throws(() => verifyControls({ ...context(head), now, authorization: authorization(head) }), errorCode('CI_LEGAL_IMMUTABLE'));
  });
}
test('adición y eliminación jurídicas son rechazadas, incluso sin diferencias técnicas', () => {
  for (const value of ['Fixture técnico nuevo\n', null]) {
    const path = value === null ? 'src/content/legal/drafts/terminos.md' : 'legal/archivo-tecnico.json';
    const head = changed(path, value);
    assert.throws(() => verifyControls({ ...context(head), now, authorization: authorization(head) }), errorCode('CI_LEGAL_IMMUTABLE'));
  }
});
test('candidato no ejecutado incluso si el cambio de su checker fue autorizado', () => {
  const sentinel = join(root, 'CANDIDATE_EXECUTED');
  const payload = `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'fallo'); throw Error('candidato ejecutado');\n`;
  const head = changed('scripts/ci/control-policy.mjs', payload);
  assert.equal(verifyControls({ ...context(head), now, authorization: authorization(head) }).controlIntegrity, 'authorized');
  assert.equal(existsSync(sentinel), false);
});
test('política manipulada en candidato no decide su propia cobertura', () => {
  const modified = { ...policy, criticalFiles: [POLICY_PATH], criticalFilePrefixes: [] };
  const head = makeCommit({ [POLICY_PATH]: JSON.stringify(modified), 'package.json': '{"scripts":{}}\n' }, base);
  const result = inspectControls(context(head));
  assert(result.changes.some(c => c.path === 'package.json'));
  assert.throws(() => verifyControls({ ...context(head), now }), errorCode('CI_AUTH_REQUIRED'));
});
test('base sin política falla cerrado; no hay bootstrap automático', () => {
  const missing = changed(POLICY_PATH, null);
  assert.throws(() => inspectControls({ ...context(missing), baseSha: missing }), errorCode('CI_POLICY_MISSING'));
});
for (const [label, bytes] of [
  ['JSON roto', '{'], ['piso jurídico ausente', JSON.stringify({ ...policy, nonAuthorizableFiles: [] })],
  ['raíz confiable sin proteger', JSON.stringify({ ...policy, criticalDirectories: ['src/legal'] })],
  ['ruta traversal', JSON.stringify({ ...policy, criticalFiles: [...policy.criticalFiles, '../escape'] })],
  ['campo desconocido', JSON.stringify({ ...policy, allowAll: true })],
]) test(`política base inválida: ${label}`, () => {
  const bad = changed(POLICY_PATH, bytes);
  assert.throws(() => inspectControls({ ...context(bad), baseSha: bad }), errorCode('CI_POLICY_SCHEMA'));
});
for (const value of ['HEAD', 'bd46ee5', '', 'A'.repeat(40), '-x']) test(`SHA inválido rechazado: ${value || '(vacío)'}`, () => {
  assert.throws(() => inspectControls({ ...context(base), headSha: value }), errorCode('CI_REF'));
});
test('objeto blob no puede usarse como commit', () => {
  const oid = git(['hash-object', '-w', '--stdin'], 'fixture\n');
  assert.throws(() => inspectControls({ ...context(base), headSha: oid }), errorCode('CI_REF'));
});
test('commit inexistente falla sin fetch ni fallback', () => {
  assert.throws(() => inspectControls({ ...context(base), headSha: '0'.repeat(40) }), errorCode('CI_GIT'));
});
test('base no ancestro rechazada por causa específica', () => {
  const sibling = changed('README.md', 'rama hermana\n');
  assert.throws(() => inspectControls({ ...context(criticalHead), baseSha: sibling }), errorCode('CI_ANCESTRY'));
});
test('límites de blob impiden lecturas excesivas', () => {
  const head = changed('.npmrc', Buffer.alloc(4 * 1024 * 1024 + 1, 97));
  assert.throws(() => inspectControls(context(head)), errorCode('CI_BLOB_SIZE'));
});
test('reloj y contexto inválidos fallan explícitamente', () => {
  assert.throws(() => verifyControls({ ...context(base), now: NaN }), errorCode('CI_AUTH_TIME'));
  assert.throws(() => inspectControls({ ...context(base), repository: 'otro/repo' }), errorCode('CI_CONTEXT'));
  assert.throws(() => inspectControls({ ...context(base), pullRequest: 0 }), errorCode('CI_CONTEXT'));
});
test('lector no altera índice ni crea archivos en el repositorio inspeccionado', () => {
  const index = readFileSync(join(root, '.git/index'));
  inspectControls(context(criticalHead));
  assert.deepEqual(readFileSync(join(root, '.git/index')), index);
  assert.equal(existsSync(join(root, POLICY_PATH)), false);
});
test('harness de proceso válido termina en 0 y negativo alcanza el validador esperado', () => {
  const moduleUrl = new URL('../scripts/ci/control-policy.mjs', import.meta.url).href;
  const run = input => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {verifyControls} from ${JSON.stringify(moduleUrl)}; try { const result=verifyControls(${JSON.stringify(input)}); console.log(result.controlIntegrity); } catch(error) { console.error(error.code); process.exitCode=1; }`],
  { cwd: root, encoding: 'utf8', timeout: 20000 });
  const success = run({ ...context(criticalHead), now, authorization: authorization(criticalHead) });
  assert.equal(success.error, undefined); assert.equal(success.status, 0); assert.match(success.stdout, /^authorized\s*$/);
  const failure = run({ ...context(criticalHead), now });
  assert.equal(failure.error, undefined); assert.equal(failure.status, 1); assert.equal(failure.stderr.trim(), 'CI_AUTH_REQUIRED');
});
for (const path of policy.criticalFiles) test(`cobertura de archivo declarado: ${path}`, () => {
  const bytes = path === POLICY_PATH ? JSON.stringify(policy, null, 4) + '\n' : 'Fixture de cobertura\n';
  const head = changed(path, bytes);
  assert.throws(() => verifyControls({ ...context(head), now }), errorCode('CI_AUTH_REQUIRED'));
});
for (const path of ['src/legal/added.ts', 'scripts/ci/nested/added.mjs', '.github/actions/added/action.yml', 'tests/legal-added.test.ts']) {
  test(`cobertura de directorio/prefijo reservado: ${path}`, () => {
    assert.throws(() => verifyControls({ ...context(changed(path, 'Fixture\n')), now }), errorCode('CI_AUTH_REQUIRED'));
  });
}
test('revocación y recuperación: nuevo SHA necesita autorización nueva o revertir cambios críticos', () => {
  const oldAuth = authorization(criticalHead);
  assert.equal(verifyControls({ ...context(criticalHead), now, authorization: oldAuth }).controlIntegrity, 'authorized');
  assert.throws(() => verifyControls({ ...context(criticalHead), now }), errorCode('CI_AUTH_REQUIRED'));
  const freshHead = makeCommit({ 'README.md': 'Nuevo evento técnico\n' }, criticalHead);
  assert.throws(() => verifyControls({ ...context(freshHead), now, authorization: oldAuth }), errorCode('CI_AUTH_BINDING'));
  assert.equal(verifyControls({ ...context(freshHead), now, authorization: authorization(freshHead) }).controlIntegrity, 'authorized');
  const restored = makeCommit({ '.github/workflows/web-ci.yml': 'name: Web fixture\non: pull_request\n' }, freshHead);
  assert.notEqual(restored, criticalHead);
  assert.equal(verifyControls({ ...context(restored), now }).controlIntegrity, 'unchanged');
});
test('eliminar o inutilizar la política candidata no se permite ni mediante mantenimiento', () => {
  for (const value of [null, '{', JSON.stringify({ ...policy, nonAuthorizableDirectories: [] })]) {
    const head = changed(POLICY_PATH, value);
    assert.throws(() => inspectControls(context(head)), errorCode('CI_POLICY_SCHEMA'));
  }
});
test('symlink existente en base tampoco se acepta por ser idéntico en candidato', () => {
  const head = changed('scripts/ci/control-policy.mjs', { mode: '120000', bytes: '/tmp/otro' });
  assert.throws(() => inspectControls({ ...context(head), baseSha: head }), errorCode('CI_ENTRY_TYPE'));
});
test('archivos working-tree e índice del candidato no sustituyen política u objetos Git', () => {
  mkdirSync(join(root, 'ci'), { recursive: true });
  writeFileSync(join(root, POLICY_PATH), '{"allowEverything":true}\n');
  try {
    assert.throws(() => verifyControls({ ...context(criticalHead), now }), errorCode('CI_AUTH_REQUIRED'));
  } finally { rmSync(join(root, 'ci'), { recursive: true, force: true }); }
});
test('diagnóstico manual sin PR ficticio solo admite la base contra sí misma', () => {
  const result = verifyCurrentControls({ root, repository: REPOSITORY, baseSha: base, headSha: base });
  assert.equal(result.pullRequest, null);
  assert.equal(result.controlIntegrity, 'unchanged');
  assert.equal(result.mergeApproval, false);
  assert.equal(result.legalVerificationRequired, true);
  assert.throws(() => verifyCurrentControls({ root, repository: REPOSITORY, baseSha: base, headSha: criticalHead }), errorCode('CI_CONTEXT'));
});
test('API de PR conserva número obligatorio; modo manual no relaja verifyControls', () => {
  assert.throws(() => verifyControls({ ...context(base), pullRequest: null }), errorCode('CI_CONTEXT'));
});
