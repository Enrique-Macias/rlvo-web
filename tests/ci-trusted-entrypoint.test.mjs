import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectControls } from '../scripts/ci/control-policy.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const baseline = 'bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4';
const repository = 'Enrique-Macias/rlvo-web';
const cleanEnv = { ...process.env };
for (const name of ['CI_CONTROL_CHANGE_AUTHORIZATION', 'CI_CONTROL_CHANGE_AUTHORIZATION_B64']) delete cleanEnv[name];
const realGit = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8', env: cleanEnv }).trim();
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('base64');
const trustedPaths = ['scripts/ci/inputs.mjs', 'scripts/ci/legal-policy.mjs', 'scripts/ci/trusted-legal.mjs',
  'scripts/ci/control-policy.mjs', 'ci/control-policy.json', '.github/workflows/legal-trust.yml', '.github/workflows/web-ci.yml'];

function fixture(callback, { trustedChecker, baseChanges = {} } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'rlvo-trusted-entry-test-'));
  const root = join(directory, 'repo'), bin = join(directory, 'bin'), fetchLog = join(directory, 'fetch.log');
  const childEnvLog = join(directory, 'child-env.log');
  mkdirSync(root); mkdirSync(bin); mkdirSync(join(directory, 'tmp'));
  const env = { ...cleanEnv, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'file', GIT_AUTHOR_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_COUNT']) delete env[key];
  const git = (args, input) => execFileSync(realGit, ['-C', root, '-c', 'core.hooksPath=/dev/null', ...args],
    { env, input, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  function commit(changes, parent) {
    git(['read-tree', parent]);
    for (const [path, bytes] of Object.entries(changes)) {
      if (bytes === null) { git(['update-index', '--force-remove', '--', path]); continue; }
      const oid = git(['hash-object', '-w', '--stdin'], bytes);
      git(['update-index', '--add', '--cacheinfo', `100644,${oid},${path}`]);
    }
    return git(['commit-tree', git(['write-tree']), '-p', parent], 'Fixture aislado del entrypoint\n');
  }
  try {
    git(['init', '--quiet', '--initial-branch=main']);
    // Transporte file únicamente: lee objetos existentes de rlvo-web y escribe solo el temporal.
    git(['fetch', '--no-tags', '--no-recurse-submodules', pathToFileURL(project).href, baseline]);
    const trusted = Object.fromEntries(trustedPaths.map(p => [p, readFileSync(join(project, p))]));
    if (trustedChecker !== undefined) trusted['scripts/ci/control-policy.mjs'] = Buffer.from(trustedChecker);
    const base = commit({ ...trusted, ...baseChanges }, baseline);
    git(['update-ref', 'HEAD', base]);
    git(['update-ref', 'refs/heads/legal-history-baseline', baseline]);
    // Materializar exclusivamente código/manifest de la base, nunca del candidato.
    for (const [path, bytes] of Object.entries(trusted)) {
      mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), bytes);
    }
    const wrapper = join(bin, 'git');
    writeFileSync(wrapper, `#!${process.execPath}\n` +
      `import {spawnSync} from 'node:child_process'; import {appendFileSync} from 'node:fs';\n` +
      `const presence={transport:Object.hasOwn(process.env,'CI_CONTROL_CHANGE_AUTHORIZATION_B64'),legacy:Object.hasOwn(process.env,'CI_CONTROL_CHANGE_AUTHORIZATION')};appendFileSync(${JSON.stringify(childEnvLog)},JSON.stringify(presence)+'\\n');if(presence.transport||presence.legacy){console.error('TEST_AUTH_ENV_INHERITED');process.exit(95);}\n` +
      `const args=process.argv.slice(2); if(args.includes('fetch')) { const i=args.indexOf('https://github.com/Enrique-Macias/rlvo-web.git'); if(i<0) { console.error('TEST_BLOCK_UNEXPECTED_FETCH'); process.exit(93); } args[i]=${JSON.stringify(root)}; appendFileSync(${JSON.stringify(fetchLog)}, JSON.stringify(args)+'\\n'); }\n` +
      `const result=spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit',env:{...process.env,GIT_ALLOW_PROTOCOL:'file'}}); process.exit(result.status??94);\n`);
    chmodSync(wrapper, 0o700);
    const context = head => ({ root, repository, pullRequest: 7, baseSha: base, headSha: head });
    function authorization(head, extra = {}) {
      const timestamp = Date.now();
      return { schemaVersion: 1, repository, pullRequest: 7, baseSha: base, headSha: head,
        changesDigest: inspectControls(context(head)).changesDigest, authorizationId: 'entry-test-authorization',
        issuedAt: new Date(timestamp - 60000).toISOString(), expiresAt: new Date(timestamp + 3600000).toISOString(), ...extra };
    }
    function run(head, { authorization: auth, authorizationBase64, legacyAuthorization,
      eventName = 'pull_request_target', envChanges = {}, payloadChanges = {}, args = [] } = {}) {
      git(['update-ref', 'refs/pull/7/head', head]);
      // Evita que refs de candidatos hermanos de un test anterior influyan en este fetch local.
      git(['update-ref', '-d', 'refs/remotes/origin/legal-candidate']);
      const eventPath = join(directory, 'event.json');
      const payload = { repository: { full_name: repository }, pull_request: { number: 7,
        base: { ref: 'main', repo: { full_name: repository }, sha: base }, head: { sha: head } }, ...payloadChanges };
      writeFileSync(eventPath, JSON.stringify(payload));
      const executionEnv = { ...env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: join(directory, 'tmp'),
        GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: eventName,
        GITHUB_REF: 'refs/heads/main', GITHUB_SHA: base, BASE_SHA: base, CANDIDATE_SHA: head,
        LEGAL_BASELINE_SHA: baseline, PR_NUMBER: eventName === 'pull_request_target' ? '7' : '',
        GITHUB_EVENT_PATH: eventPath, ...envChanges };
      delete executionEnv.CI_CONTROL_CHANGE_AUTHORIZATION;
      delete executionEnv.CI_CONTROL_CHANGE_AUTHORIZATION_B64;
      const transport = authorizationBase64 ?? (auth === undefined ? undefined : encode(auth));
      if (transport !== undefined) executionEnv.CI_CONTROL_CHANGE_AUTHORIZATION_B64 = transport;
      if (legacyAuthorization !== undefined) executionEnv.CI_CONTROL_CHANGE_AUTHORIZATION = legacyAuthorization;
      const processResult = spawnSync(process.execPath, ['scripts/ci/trusted-legal.mjs', ...args],
        { cwd: root, env: executionEnv, encoding: 'utf8', timeout: 30000 });
      assert.equal(processResult.error, undefined, processResult.error?.message);
      const output = processResult.stdout + processResult.stderr;
      for (const value of [transport, legacyAuthorization, typeof auth === 'string' ? auth : auth && JSON.stringify(auth)]) {
        if (typeof value === 'string' && value.trim().length >= 32) {
          assert.equal(output.includes(value), false, 'No se imprime transporte ni documento de autorización');
        }
      }
      const lines = (processResult.status === 0 ? processResult.stdout : processResult.stderr).trim().split('\n');
      const record = JSON.parse(lines.findLast(line => line.startsWith('{')) ?? 'null');
      assert(record, `El proceso debe llegar al entrypoint: ${processResult.stderr}`);
      if (existsSync(fetchLog)) {
        for (const line of readFileSync(fetchLog, 'utf8').trim().split('\n')) {
          const args = JSON.parse(line);
          assert(args.includes(root)); assert(!args.some(a => a.startsWith('https:') || a.startsWith('http:')));
        }
      }
      if (existsSync(childEnvLog)) for (const line of readFileSync(childEnvLog, 'utf8').trim().split('\n')) {
        assert.deepEqual(JSON.parse(line), { transport: false, legacy: false }, 'Ningún Git hijo recibe autorización');
      }
      assert.deepEqual(git(['rev-parse', 'HEAD']), base, 'Nunca se hace checkout del candidato');
      return { ...processResult, record };
    }
    callback({ root, directory, base, baseline, git, commit, run, authorization, fetchLog, childEnvLog });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.record.conclusion, 'success');
  assert.equal(result.record.checks.controls.conclusion, 'success');
  assert.deepEqual(result.record.checks.legal, { conclusion: 'success', releases: 0, markers: 23 });
  assert.equal(result.record.mergeApproval, false);
}
function controlFailure(result, code) {
  assert.equal(result.status, 1);
  assert.equal(result.record.code, 'CI_TRUST_FAILURE');
  assert.equal(result.record.checks.controls.conclusion, 'failure');
  assert.equal(result.record.checks.controls.code, code);
  assert.deepEqual(result.record.checks.legal, { conclusion: 'success', releases: 0, markers: 23 }, 'El control jurídico original también debe ejecutarse');
}

test('entrypoint PR normal sin Secret: exit 0, ambos controles ejecutados', () => fixture(f => {
  const head = f.commit({ 'README.md': 'Cambio técnico de fixture\n' }, f.base);
  success(f.run(head));
}));
test('entrypoint cambio crítico sin Secret: exit 1 por CI_AUTH_REQUIRED y jurídico success', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head), 'CI_AUTH_REQUIRED');
}));
test('entrypoint autorización completa válida: exit 0 sin omitir verificación jurídica', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorization: f.authorization(head) });
  success(result); assert.equal(result.record.checks.controls.controlIntegrity, 'authorized');
}));
for (const [label, extra, expected] of [
  ['caducada', () => ({ issuedAt: new Date(Date.now() - 7200000).toISOString(), expiresAt: new Date(Date.now() - 3600000).toISOString() }), 'CI_AUTH_EXPIRED'],
  ['otro SHA', () => ({ headSha: 'a'.repeat(40) }), 'CI_AUTH_BINDING'],
  ['otro PR', () => ({ pullRequest: 8 }), 'CI_AUTH_BINDING'],
  ['otro repositorio', () => ({ repository: 'otro/repo' }), 'CI_AUTH_BINDING'],
  ['digest incorrecto', () => ({ changesDigest: '0'.repeat(64) }), 'CI_AUTH_DIGEST'],
]) test(`entrypoint autorización ${label}: causa exacta y jurídico independiente`, () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { authorization: f.authorization(head, extra()) }), expected);
}));
test('entrypoint autorización JSON inválida: fallo real sin impedir el control jurídico', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { authorization: '{' }), 'CI_AUTH_SCHEMA');
}));
test('JSON malformado transportado en Base64 no bloquea PR normal sin cambios críticos', () => fixture(f => {
  success(f.run(f.commit({ 'README.md': 'Cambio ordinario\n' }, f.base), { authorization: '{' }));
}));
test('alteración simultánea de checker, entrypoint y tests del candidato no se ejecuta', () => fixture(f => {
  const sentinel = join(f.directory, 'CANDIDATE_EXECUTED');
  const payload = `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'fallo');process.exit(0);\n`;
  const head = f.commit({ 'scripts/ci/control-policy.mjs': payload, 'scripts/ci/trusted-legal.mjs': payload,
    'tests/ci-forged.test.mjs': payload }, f.base);
  controlFailure(f.run(head), 'CI_AUTH_REQUIRED');
  assert.equal(existsSync(sentinel), false);
}));
test('alteración de workflow para skipped o continue-on-error es rechazada desde base', () => fixture(f => {
  const head = f.commit({ '.github/workflows/legal-trust.yml': 'jobs:\n  integrity:\n    name: legal-integrity\n    if: false\n    continue-on-error: true\n' }, f.base);
  controlFailure(f.run(head), 'CI_AUTH_REQUIRED');
}));
test('archivo de autorización del PR no equivale al Secret externo', () => fixture(f => {
  const first = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const head = f.commit({ 'authorization.json': JSON.stringify(f.authorization(first)) }, first);
  controlFailure(f.run(head), 'CI_AUTH_REQUIRED');
}));
test('autorización retirada: nueva evaluación falla, sin fingir revocación del verde anterior', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  success(f.run(head, { authorization: f.authorization(head) }));
  controlFailure(f.run(head), 'CI_AUTH_REQUIRED');
}));
test('autorización exacta de CI no permite alterar documentos: jurídico también falla', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n',
    'src/content/legal/drafts/terminos.md': 'Fixture técnico alterado, no publicable\n' }, f.base);
  const result = f.run(head, { authorization: f.authorization(head) });
  assert.equal(result.status, 1);
  assert.equal(result.record.checks.controls.code, 'CI_LEGAL_IMMUTABLE');
  assert.equal(result.record.checks.legal.conclusion, 'failure');
  assert.match(result.record.checks.legal.message, /Contenido jurídico o control congelado alterado/);
}));
test('CI autorizado no omite checker histórico si base/head repiten un lock defectuoso', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorization: f.authorization(head) });
  assert.equal(result.status, 1);
  assert.equal(result.record.checks.controls.conclusion, 'success');
  assert.equal(result.record.checks.controls.controlIntegrity, 'authorized');
  assert.equal(result.record.checks.legal.conclusion, 'failure');
  assert.match(result.record.checks.legal.message, /Formato de baseline no admitido/);
}, { baseChanges: { 'legal/releases.lock.json': '{"schemaVersion":1,"files":{},"records":{}}\n' } }));
test('CI autorizado no omite drafts-only aunque base/head tengan los mismos bytes alterados', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorization: f.authorization(head) });
  assert.equal(result.status, 1);
  assert.equal(result.record.checks.controls.conclusion, 'success');
  assert.equal(result.record.checks.legal.conclusion, 'failure');
  assert.match(result.record.checks.legal.message, /Contenido jurídico o control congelado alterado/);
}, { baseChanges: { 'src/content/legal/drafts/terminos.md': 'Fixture técnico alterado en base, no publicable\n' } }));
for (const [label, trustedChecker] of [
  ['error interno', 'export function inspectControls(){return {changes:[],legalChanges:[]}};export function verifyControls(){throw Error("INTERNAL_FIXTURE")}\n'],
  ['error de sintaxis al cargar', 'esto no es javascript válido !!!\n'],
  ['throw sin objeto Error', 'export function inspectControls(){return {changes:[],legalChanges:[]}};export function verifyControls(){throw null}\n'],
]) test(`checker confiable con ${label}: job falla y control jurídico sigue ejecutándose`, () => fixture(f => {
  const result = f.run(f.commit({ 'README.md': 'Cambio normal\n' }, f.base));
  controlFailure(result, 'CI_CONTROL_INTERNAL');
}, { trustedChecker }));
test('workflow_dispatch conserva diagnóstico sobre main sin inventar PR ni usar autorización', () => fixture(f => {
  const result = f.run(f.base, { eventName: 'workflow_dispatch', authorization: '{' });
  success(result); assert.equal(result.record.pullRequest, null);
  assert.equal(result.record.checks.controls.authorizationId, null);
}));
test('workflow_dispatch no permite evaluar head distinto ni simular un PR', () => fixture(f => {
  const head = f.commit({ 'README.md': 'Otro candidato\n' }, f.base);
  const result = f.run(head, { eventName: 'workflow_dispatch' });
  assert.equal(result.status, 1); assert.equal(result.record.code, 'CI_EVENT_CONTEXT');
  assert.equal(existsSync(f.fetchLog), false);
}));
test('rama incorrecta falla antes del fetch en lugar de reportar skipped', () => fixture(f => {
  const result = f.run(f.base, { envChanges: { GITHUB_REF: 'refs/heads/otra' } });
  assert.equal(result.status, 1); assert.equal(result.record.code, 'CI_EVENT_CONTEXT');
  assert.equal(existsSync(f.fetchLog), false);
}));
test('payload no coincidente no puede aportar SHA ni número de PR', () => fixture(f => {
  const result = f.run(f.base, { payloadChanges: { repository: { full_name: 'otro/repo' } } });
  assert.equal(result.status, 1); assert.equal(result.record.code, 'CI_EVENT_CONTEXT');
  assert.equal(existsSync(f.fetchLog), false);
}));
test('pin no coincidente con rama histórica falla cerrado', () => fixture(f => {
  const result = f.run(f.base, { envChanges: { LEGAL_BASELINE_SHA: f.base } });
  assert.equal(result.status, 1); assert.match(result.record.message, /pin no coincide/);
}));
test('entrypoint no admite flags o archivos de autorización por CLI', () => fixture(f => {
  const result = f.run(f.base, { args: ['--skip-controls'] });
  assert.equal(result.status, 1); assert.equal(result.record.code, 'CI_EVENT_CONTEXT');
  assert.equal(existsSync(f.fetchLog), false);
}));

for (const [label, value] of [
  ['JSON plano', '{"private":"PRIVATE_TRANSPORT_FRAGMENT_DO_NOT_PRINT"}'],
  ['espacio inicial', ' e30='],
  ['espacio final', 'e30= '],
  ['salto de línea', 'e30=\n'],
  ['padding ausente', 'ew'],
  ['padding excesivo', 'ew==='],
  ['alfabeto URL-safe', '____'],
  ['bits de padding no canónicos', 'Zh=='],
  ['UTF-8 inválido', Buffer.from([0xc3, 0x28]).toString('base64')],
  ['UTF-8 sobrelargo', Buffer.from([0xc0, 0xaf]).toString('base64')],
  ['límite de transporte excedido', 'A'.repeat(8196)],
]) test(`transporte ${label}: CI_AUTH_TRANSPORT, exit 1 y jurídico success`, () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorizationBase64: value });
  controlFailure(result, 'CI_AUTH_TRANSPORT');
  assert.equal((result.stdout + result.stderr).includes('PRIVATE_TRANSPORT_FRAGMENT_DO_NOT_PRINT'), false);
}));

test('transporte vacío conserva CI_AUTH_REQUIRED, no se convierte en error de codec', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { authorizationBase64: '' }), 'CI_AUTH_REQUIRED');
}));
test('límite exacto de 8192 caracteres alcanza JSON.parse y conserva CI_AUTH_SCHEMA', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const transport = encode(' '.repeat(6143) + '{'); assert.equal(transport.length, 8192);
  controlFailure(f.run(head, { authorizationBase64: transport }), 'CI_AUTH_SCHEMA');
}));
test('UTF-8 válido con BOM no se normaliza para aceptar un JSON anteriormente inválido', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { authorization: '\ufeff' + JSON.stringify(f.authorization(head)) }), 'CI_AUTH_SCHEMA');
}));
test('decodificación diferida: PR ordinario ignora incluso transporte inválido o excesivo', () => fixture(f => {
  const head = f.commit({ 'README.md': 'Cambio ordinario\n' }, f.base);
  for (const value of ['not_base64_PRIVATE_UNUSED_VALUE', 'A'.repeat(8196)]) success(f.run(head, { authorizationBase64: value }));
}));
test('diagnóstico manual tampoco decodifica transporte inválido', () => fixture(f => {
  success(f.run(f.base, { eventName: 'workflow_dispatch', authorizationBase64: 'not_base64_PRIVATE_UNUSED_VALUE' }));
}));
test('cambio jurídico mantiene prioridad incluso con transporte inválido', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n',
    'src/content/legal/drafts/terminos.md': 'Fixture técnico no publicable\n' }, f.base);
  const result = f.run(head, { authorizationBase64: 'invalid_transport' });
  assert.equal(result.status, 1); assert.equal(result.record.code, 'CI_TRUST_FAILURE');
  assert.equal(result.record.checks.controls.code, 'CI_LEGAL_IMMUTABLE');
  assert.equal(result.record.checks.legal.conclusion, 'failure');
  assert.match(result.record.checks.legal.message, /Contenido jurídico o control congelado alterado/);
}));
test('JSON correcto en el canal antiguo no autoriza y no llega a procesos hijos', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { legacyAuthorization: JSON.stringify(f.authorization(head)) }), 'CI_AUTH_REQUIRED');
}));
test('únicamente Base64 decide; canal antiguo inválido se elimina y no sustituye el Secret', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorization: f.authorization(head), legacyAuthorization: 'PRIVATE_LEGACY_FRAGMENT_DO_NOT_PRINT' });
  success(result); assert.equal(result.record.checks.controls.controlIntegrity, 'authorized');
  const childCalls = readFileSync(f.childEnvLog, 'utf8').trim().split('\n');
  assert(childCalls.length > 2, 'Se inspecciona entorno en fetch y verificaciones, no solo en un hijo');
}));
test('JSON inválido con fragmento privado conserva CI_AUTH_SCHEMA sin reflejar el parser', () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  const result = f.run(head, { authorization: '{"private":"PRIVATE_JSON_FRAGMENT_DO_NOT_PRINT"' });
  controlFailure(result, 'CI_AUTH_SCHEMA');
  assert.equal((result.stdout + result.stderr).includes('PRIVATE_JSON_FRAGMENT_DO_NOT_PRINT'), false);
}));
for (const [label, change] of [
  ['campo adicional', auth => ({ ...auth, allowLegal: true })],
  ['campo ausente', auth => { const { headSha, ...rest } = auth; return rest; }],
]) test(`codec no relaja contrato de nueve campos: ${label}`, () => fixture(f => {
  const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
  controlFailure(f.run(head, { authorization: change(f.authorization(head)) }), 'CI_AUTH_SCHEMA');
}));

for (const code of ['CI_AUTH_SCHEMA', 'PRIVATE_ERROR_CODE_DO_NOT_PRINT']) {
  test(`error interno no refleja JSON ni códigos arbitrarios (${code === 'CI_AUTH_SCHEMA' ? 'código conocido' : 'código privado'})`, () => fixture(f => {
    const head = f.commit({ 'tests/ci-example.test.mjs': '/* fixture */\n' }, f.base);
    const result = f.run(head, { authorization: f.authorization(head) });
    controlFailure(result, code === 'CI_AUTH_SCHEMA' ? code : 'CI_CONTROL_INTERNAL');
    assert.equal(existsSync(join(f.root, 'ERROR_BRANCH_REACHED')), true, 'El negativo debe alcanzar el throw previsto');
    assert.equal((result.stdout + result.stderr).includes('PRIVATE_ERROR_CODE_DO_NOT_PRINT'), false);
    assert.equal((result.stdout + result.stderr).includes('PRIVATE_ERROR_FRAGMENT_DO_NOT_PRINT'), false);
  }, { trustedChecker: `import {writeFileSync} from 'node:fs';
export function inspectControls(){return {changes:[{}],legalChanges:[]}}
export function verifyControls({root,authorization}){writeFileSync(root+'/ERROR_BRANCH_REACHED','reached');const e=new Error('PRIVATE_ERROR_FRAGMENT_DO_NOT_PRINT'+authorization);e.code=${JSON.stringify(code)};throw e}
` }));
}
test('Secret válido tampoco permite ejecutar checker ni entrypoint del candidato', () => fixture(f => {
  const sentinel = join(f.directory, 'AUTHORIZED_CANDIDATE_EXECUTED');
  const payload = `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'fallo');process.exit(0);\n`;
  const head = f.commit({ 'scripts/ci/control-policy.mjs': payload, 'scripts/ci/trusted-legal.mjs': payload }, f.base);
  success(f.run(head, { authorization: f.authorization(head) }));
  assert.equal(existsSync(sentinel), false);
}));
