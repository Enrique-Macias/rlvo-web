import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { beginRun, binding, captureContext, captureSourceHash, currentReport, digest, finishRun, historicalReport, readJSON,
  runDirectory, saveRun, sealRun, validateCurrentRun, writeJSON } from '../scripts/qa/evidence.mjs';
import { expectedCoverage, interactionTitles, lighthousePages, lighthouseSettings, matrixTitles } from '../scripts/qa/results.mjs';
import { runCommand } from '../scripts/qa/command.mjs';
import { assertProtectedSources, protectedSources, verifyProtectedFiles } from '../scripts/qa/integrity.mjs';

const repository = process.cwd();

test('inventario QA conserva las 70 rutas originales y solo las tres incorporaciones CI', () => {
  assert.equal(protectedSources.length, 73); assert.equal(new Set(protectedSources).size, 73);
  const previous = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', '614b91ff1eaa7c8d90bb732e61d45b015169fe10'], { encoding: 'utf8' }).trim().split('\n'));
  assert.equal(protectedSources.filter(path => previous.has(path)).length, 70);
  assert.deepEqual(protectedSources.filter(path => !previous.has(path)), [
    'scripts/ci/control-policy.mjs', 'tests/ci-control-policy.test.mjs', 'tests/ci-trusted-entrypoint.test.mjs',
  ]);
  assert.equal(verifyProtectedFiles(), 73);
});
const expectProtectedSetRejection = paths => assert.throws(() => assertProtectedSources(paths), error => {
  assert.equal(error.code, 'ERR_ASSERTION'); assert.match(error.message, /Conjunto de fuentes protegidas inesperado/);
  assert.deepEqual(error.actual, [...paths].sort()); assert.deepEqual(error.expected, protectedSources); return true;
});
test('inventario QA rechaza la pérdida de cualquiera de las 73 fuentes', () => {
  for (const path of protectedSources) expectProtectedSetRejection(protectedSources.filter(value => value !== path));
});
test('inventario QA rechaza una sustitución aunque se conserve el conteo 73', () => {
  expectProtectedSetRejection([...protectedSources.slice(1), 'scripts/ci/no-aprobado.mjs']);
});
test('inventario QA rechaza fuentes adicionales no aprobadas', () => {
  expectProtectedSetRejection([...protectedSources, 'scripts/ci/no-aprobado.mjs']);
});
test('inventario QA rechaza duplicados que oculten una fuente ausente', () => {
  expectProtectedSetRejection([...protectedSources.slice(1), protectedSources[1]]);
});

function fixture(t, realGit = false) {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'rlvo-qa-evidence-')));
  const cwd = realGit ? join(temporary, 'repo') : temporary, root = join(cwd, 'qa');
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  if (realGit) {
    // Solo clon local del commit existente: sin red, commits nuevos ni cambios al repositorio origen.
    execFileSync('git', ['clone', '--shared', '--no-checkout', '--quiet', '--', repository, cwd]);
    writeFileSync(join(cwd, '.gitignore'), '/node_modules/\n/qa/\n');
    mkdirSync(join(cwd, 'src')); writeFileSync(join(cwd, 'src/fixture.ts'), 'export const fixture = true;\n');
    for (const name of ['@playwright/test', '@axe-core/playwright', 'axe-core', 'lighthouse']) {
      mkdirSync(join(cwd, 'node_modules', name), { recursive: true });
      writeJSON(join(cwd, 'node_modules', name, 'package.json'), { version: readJSON(join(repository, 'node_modules', name, 'package.json')).version });
    }
    mkdirSync(join(cwd, 'node_modules/playwright-core'), { recursive: true });
    writeFileSync(join(cwd, 'node_modules/playwright-core/browsers.json'), readFileSync(join(repository, 'node_modules/playwright-core/browsers.json')));
  }
  const context = realGit ? captureContext(cwd) : { revision: '6'.repeat(40), sourceHash: 'a'.repeat(64), runtime: { node: process.version,
    platform: process.platform, arch: process.arch, tools: { '@playwright/test': '1.64.1', '@axe-core/playwright': '4.14.0', 'axe-core': '4.14.0', lighthouse: '13.6.0' } } };
  function create(profile = 'smoke', complete = true) {
    const run = beginRun(root, profile);
    run.context = structuredClone(context); saveRun(root, run);
    const directory = runDirectory(root, run.runId), qa = binding(run);
    writeJSON(join(directory, 'integrity.json'), { qa, protectedFiles: 73, unchanged: true, releases: 0,
      current: { terminos: null, aviso_privacidad: null } });
    if (profile === 'lighthouse') {
      const summary = { qa, conditions: lighthouseSettings, target: 95, blockingThreshold: false, pages: [] };
      for (const [slug, path] of lighthousePages) {
        const scores = Object.fromEntries(lighthouseSettings.onlyCategories.map(category => [category, category === 'best-practices' ? 96 : 100]));
        const runs = [1, 2, 3].map(index => {
          writeJSON(join(directory, `${slug}-${index}.json`), { qa, fetchTime: run.startedAt, lighthouseVersion: '13.6.0', configSettings: lighthouseSettings,
            requestedUrl: `http://127.0.0.1:12345${path}`, categories: Object.fromEntries(Object.entries(scores).map(([key, score]) => [key, { score: score / 100 }])) });
          writeFileSync(join(directory, `${slug}-${index}.html`), '<p>Fixture de prueba, sin medición real.</p>');
          return { run: index, scores };
        });
        summary.pages.push({ path, runs, medians: scores, belowTarget: [] });
      }
      writeJSON(join(directory, 'summary.json'), summary);
    } else {
      const coverage = expectedCoverage(profile), specs = [];
      const axe = { testEngine: { version: '4.14.0' }, violations: [], passes: [{ id: 'target-size', nodes: [] }], inapplicable: [],
        incomplete: [{ id: 'color-contrast', nodes: [{ target: ['.fixture'], failureSummary: 'Revisión humana pendiente' }] }] };
      for (const [projectName, titles] of Object.entries(coverage)) for (const title of titles) {
        const name = matrixTitles.includes(title) ? 'axe' : title === interactionTitles[2] ? 'axe-expanded' : null;
        specs.push({ title, file: matrixTitles.includes(title) ? 'matrix.spec.ts' : 'interactions.spec.ts',
          tests: [{ projectName, expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0, errors: [], startTime: run.startedAt,
            attachments: name ? [{ name, body: Buffer.from(JSON.stringify(axe)).toString('base64') }] : [] }] }] });
      }
      writeJSON(join(directory, 'results.json'), { config: { metadata: { qa }, version: '1.64.1', projects: Object.keys(coverage).map(name => ({ name })) },
        errors: [], stats: { startTime: run.startedAt, duration: 1, expected: specs.length, unexpected: 0, skipped: 0, flaky: 0 }, suites: [{ specs }] });
    }
    if (complete) { sealRun(root, run); finishRun(root, run, 'passed'); }
    return { run, directory, edit(file, change) { const path = join(directory, file), json = readJSON(path); change(json); writeJSON(path, json); } };
  }
  return { root, cwd, context, create };
}
const check = f => validateCurrentRun(f.root, 'smoke', f.context);
// Únicamente tests de consumo/CLI: conservar hashes correctos para aislar el rechazo semántico.
// El sellador de producción nunca usa este helper ni permite omitir validateData.
function resealBytesForTest(directory) {
  const path = join(directory, 'evidence.json'), seal = readJSON(path);
  for (const name of Object.keys(seal.files)) seal.files[name] = digest(readFileSync(join(directory, name)));
  writeJSON(path, seal);
}
const expectSemanticRejection = (f, run, expected) => {
  assert.equal(existsSync(join(run.directory, 'evidence.json')), false, 'El caso semántico debe estar sin sellar');
  assert.throws(() => sealRun(f.root, run.run), expected);
  assert.equal(existsSync(join(run.directory, 'evidence.json')), false, 'No se debe sellar evidencia inválida');
};

test('smoke completo: evidencia actual válida, alcance explícito e incomplete conservados', t => {
  const f = fixture(t), { run } = f.create();
  const report = currentReport(f.root, ['smoke'], f.context);
  assert.equal(report.status, 'valid'); assert.equal(report.automatedApproval, true);
  assert.deepEqual(report.scope, ['smoke']); assert.equal(report.profiles.smoke.stats.expected, 12);
  assert.equal(report.profiles.smoke.run.runId, run.runId); assert.equal(report.profiles.smoke.manualReview.length, 8);
});
test('perfiles separados compatibles: 12 smoke, 99 full y nueve mediciones Lighthouse', t => {
  const f = fixture(t), a = f.create(), b = f.create('full'), c = f.create('lighthouse');
  assert.equal(new Set([a.run.runId, b.run.runId, c.run.runId]).size, 3);
  const report = currentReport(f.root, ['smoke', 'full', 'lighthouse'], f.context);
  assert.equal(report.profiles.full.stats.expected, 99);
  assert.equal(report.profiles.lighthouse.lighthouse.pages.flatMap(p => p.runs).length, 9);
});
test('nueva invocación invalida aprobación anterior desde el inicio', t => {
  const f = fixture(t); f.create(); currentReport(f.root, ['smoke'], f.context);
  const latest = beginRun(f.root, 'smoke');
  assert.equal(readJSON(join(f.root, 'summary.json')).automatedApproval, false);
  assert.throws(() => check(f), /running/);
  finishRun(f.root, latest, 'failed', new Error('Fallo de build antes de Playwright'));
  assert.throws(() => check(f), /failed/);
});
for (const state of ['running', 'failed', 'interrupted']) test(`rechaza ejecución ${state} aunque existan resultados previos`, t => {
  const f = fixture(t); f.create(); const latest = f.create('smoke', false);
  if (state !== 'running') finishRun(f.root, latest.run, state);
  assert.throws(() => currentReport(f.root, ['smoke'], f.context), new RegExp(state));
  assert.equal(readJSON(join(f.root, 'summary.json')).status, 'invalid');
});
for (const key of ['revision', 'sourceHash', 'runtime']) test(`rechaza resultados antiguos o incompatibles por ${key}`, t => {
  const f = fixture(t); f.create(); const current = structuredClone(f.context);
  if (key === 'runtime') current.runtime.node = 'v0.0.0'; else current[key] = 'b'.repeat(key === 'revision' ? 40 : 64);
  assert.throws(() => currentReport(f.root, ['smoke'], current), /antigua o incompatible/);
  assert.equal(readJSON(join(f.root, 'summary.json')).automatedApproval, false);
});
for (const file of ['run.json', 'results.json', 'integrity.json', 'evidence.json']) test(`rechaza resultado ausente: ${file}`, t => {
  const f = fixture(t), run = f.create(); rmSync(join(run.directory, file));
  assert.throws(() => check(f), error => error.code === 'ENOENT' && error.path === join(run.directory, file));
});
for (const file of ['results.json', 'integrity.json', 'evidence.json']) test(`rechaza JSON inválido: ${file}`, t => {
  const f = fixture(t), run = f.create(); writeFileSync(join(run.directory, file), '{'); assert.throws(() => check(f), { name: 'SyntaxError' });
});
const mutations = [
  ['identificador incompatible', 'results.json', r => { r.config.metadata.qa.runId = '0'.repeat(36); }, /Playwright de otra ejecución/],
  ['perfil incompatible', 'results.json', r => { r.config.metadata.qa.profile = 'full'; }, /Playwright de otra ejecución/],
  ['huella incompatible', 'results.json', r => { r.config.metadata.qa.contextHash = '0'.repeat(64); }, /Playwright de otra ejecución/],
  ['integridad de otro ID', 'integrity.json', r => { r.qa.runId = '0'.repeat(36); }, /Integridad de otra ejecución/],
  ['integridad fallida', 'integrity.json', r => { r.unchanged = false; }, /Integridad fallida/],
  ['cobertura protegida incompleta', 'integrity.json', r => { r.protectedFiles = 72; }, /Cobertura protegida inesperada/],
  ['conteo histórico de 70', 'integrity.json', r => { r.protectedFiles = 70; }, /Cobertura protegida inesperada/],
  ['cobertura protegida inesperada', 'integrity.json', r => { r.protectedFiles = 74; }, /Cobertura protegida inesperada/],
  ['timestamp de otro momento', 'results.json', r => { r.stats.startTime = '2000-01-01T00:00:00Z'; }, /Resultados Playwright anteriores/],
  ['resultado fallido', 'results.json', r => { r.suites[0].specs[0].tests[0].results[0].status = 'failed'; }, /Resultado fallido o reintentado/],
  ['resultado omitido', 'results.json', r => { r.suites[0].specs[0].tests[0].status = 'skipped'; }, /Caso fallido, flaky u omitido/],
  ['resultado reintentado', 'results.json', r => { r.suites[0].specs[0].tests[0].results[0].retry = 1; }, /Resultado fallido o reintentado/],
  ['cobertura parcial', 'results.json', r => { r.suites[0].specs.pop(); }, /Cobertura incompleta o duplicada/],
  ['cobertura duplicada', 'results.json', r => { r.suites[0].specs.push(r.suites[0].specs[0]); }, /Cobertura incompleta o duplicada/],
  ['proyecto ausente', 'results.json', r => { r.config.projects = []; }, /Proyectos incompletos/],
  ['error temprano Playwright', 'results.json', r => { r.errors.push({ message: 'Error de configuración' }); }, /Errores globales de Playwright/],
  ['axe ausente', 'results.json', r => { r.suites[0].specs[0].tests[0].results[0].attachments = []; }, /Evidencia axe ausente/],
  ['axe con infracción', 'results.json', r => {
    const a = r.suites[0].specs[0].tests[0].results[0].attachments[0], axe = JSON.parse(Buffer.from(a.body, 'base64'));
    axe.violations.push({ id: 'color-contrast' }); a.body = Buffer.from(JSON.stringify(axe)).toString('base64');
  }, /Infracciones confirmadas por axe/],
];
for (const [name, file, mutate, expected] of mutations) test(`semántica previa al sello: ${name}`, t => {
  const f = fixture(t), run = f.create('smoke', false); run.edit(file, mutate);
  expectSemanticRejection(f, run, expected);
});
for (const [name, file, mutate, expected] of [
  ['sello de otro ID', 'evidence.json', r => { r.qa.runId = '0'.repeat(36); }, /Sello de otra ejecución/],
  ['esquema desconocido', 'run.json', r => { r.schemaVersion = 2; }, /Esquema de ejecución no admitido/],
  ['cierre sin código cero', 'run.json', r => { r.exitCode = 1; }, /Cierre incoherente/],
]) test(`metadata: ${name}`, t => {
  const f = fixture(t), run = f.create(); run.edit(file, mutate); assert.throws(() => check(f), expected);
});
test('detecta alteración de bytes aunque el resultado siga siendo válido', t => {
  const f = fixture(t), run = f.create();
  writeFileSync(join(run.directory, 'results.json'), readFileSync(join(run.directory, 'results.json'), 'utf8') + '\n');
  assert.throws(() => check(f), /Bytes de evidencia alterados/);
});
test('Lighthouse ausente no se sustituye con resultados de otros perfiles', t => {
  const f = fixture(t); f.create(); f.create('full');
  assert.throws(() => currentReport(f.root, ['smoke', 'full', 'lighthouse'], f.context), error => error.code === 'ENOENT' && error.path.endsWith('latest/lighthouse.json'));
});
for (const [name, file, mutate, expected] of [
  ['mezcla de IDs', 'inicio-1.json', r => { r.qa.runId = '0'.repeat(36); }, /Medición Lighthouse de otra ejecución/],
  ['runtimeError', 'inicio-1.json', r => { r.runtimeError = { code: 'NO_FCP' }; }, /Lighthouse fallido o antiguo/],
  ['medición ausente', 'summary.json', r => { r.pages[0].runs.pop(); }, /Se requieren tres mediciones/],
  ['mediana falsa', 'summary.json', r => { r.pages[0].medians.performance = 50; }, /Medianas incoherentes/],
  ['configSettings ausente', 'inicio-1.json', r => { delete r.configSettings; }, /Condiciones efectivas Lighthouse ausentes/],
  ['desktop frente a mobile', 'inicio-1.json', r => { r.configSettings.formFactor = 'desktop'; }, /Condición efectiva Lighthouse incompatible: formFactor/],
  ['viewport incompatible', 'inicio-1.json', r => { r.configSettings.screenEmulation.width = 1280; }, /Condición efectiva Lighthouse incompatible: screenEmulation/],
  ['throttling incompatible', 'inicio-1.json', r => { r.configSettings.throttling.cpuSlowdownMultiplier = 1; }, /Throttling efectivo Lighthouse incompatible: cpuSlowdownMultiplier/],
]) test(`semántica Lighthouse antes del sello: ${name}`, t => {
  const f = fixture(t), run = f.create('lighthouse', false); run.edit(file, mutate);
  expectSemanticRejection(f, run, expected);
});
test('Lighthouse inferior al objetivo se informa sin inventar un umbral absoluto', t => {
  const f = fixture(t), run = f.create('lighthouse', false);
  for (const n of [1, 2, 3]) run.edit(`inicio-${n}.json`, r => { r.categories.performance.score = 0.9; });
  run.edit('summary.json', r => {
    r.pages[0].runs.forEach(result => { result.scores.performance = 90; });
    r.pages[0].medians.performance = 90; r.pages[0].belowTarget = [{ category: 'performance', score: 90 }];
  });
  sealRun(f.root, run.run); finishRun(f.root, run.run, 'passed');
  assert.equal(validateCurrentRun(f.root, 'lighthouse', f.context).lighthouse.pages[0].belowTarget[0].score, 90);
});
test('un perfil incompatible impide aprobar el agregado completo', t => {
  const f = fixture(t); f.create(); const old = f.create('full');
  old.run.context.sourceHash = 'b'.repeat(64); saveRun(f.root, old.run);
  assert.throws(() => currentReport(f.root, ['smoke', 'full'], f.context), /incompatible/);
});
test('inspección histórica explícita: informa incluso fallos y nunca cambia la aprobación actual', t => {
  const f = fixture(t), old = f.create(); currentReport(f.root, ['smoke'], f.context);
  const before = readFileSync(join(f.root, 'summary.json'));
  const report = historicalReport(f.root, old.run.runId);
  assert.equal(report.automatedApproval, false); assert.equal(report.mode, 'historical');
  assert.deepEqual(readFileSync(join(f.root, 'summary.json')), before);
  const failed = beginRun(f.root, 'full'); finishRun(f.root, failed, 'failed', 'build fallido');
  assert.equal(historicalReport(f.root, failed.runId).run.status, 'failed');
});
test('histórico anterior al contrato solo se consulta mediante legacy explícito', t => {
  const f = fixture(t); mkdirSync(join(f.root, 'smoke'), { recursive: true });
  writeJSON(join(f.root, 'smoke', 'run.json'), { status: 'passed' });
  assert.throws(() => check(f), error => error.code === 'ENOENT' && error.path.endsWith('latest/smoke.json'));
  assert.equal(historicalReport(f.root, 'legacy:smoke').automatedApproval, false);
  assert.throws(() => historicalReport(f.root, 'legacy:../../otro'), /Perfil histórico inválido/);
});
test('un run anterior que termina más tarde no reemplaza el puntero nuevo', t => {
  const f = fixture(t), a = f.create('smoke', false), b = f.create();
  sealRun(f.root, a.run); finishRun(f.root, a.run, 'passed');
  assert.equal(check(f).run.runId, b.run.runId);
});
test('fallo al capturar contexto y cambio durante el reporte invalidan resumen anterior', t => {
  const f = fixture(t); f.create(); currentReport(f.root, ['smoke'], f.context);
  assert.throws(() => currentReport(f.root, ['smoke'], () => { throw new Error('Fuente ausente'); }), /Fuente ausente/);
  assert.equal(readJSON(join(f.root, 'summary.json')).automatedApproval, false);
  let count = 0;
  assert.throws(() => currentReport(f.root, ['smoke'], () => count++ ? { ...f.context, sourceHash: 'b'.repeat(64) } : f.context), /cambiaron/);
});
test('lock ocupado falla cerrado y no se elimina automáticamente', t => {
  const f = fixture(t); f.create(); writeFileSync(join(f.root, '.state.lock'), '');
  assert.throws(() => currentReport(f.root, ['smoke'], f.context), /EEXIST/);
  assert.throws(() => beginRun(f.root, 'full'), /EEXIST/);
  assert.equal(readFileSync(join(f.root, '.state.lock'), 'utf8'), '');
});
const cli = (f, args) => spawnSync(process.execPath, [resolve(repository, 'scripts/qa/report.mjs'), ...args], { cwd: f.cwd, encoding: 'utf8', timeout: 10000 });
test('CLI real con Git válido: evidencia actual completa termina cero', t => {
  const f = fixture(t, true); f.create(); f.create('full'); f.create('lighthouse');
  const result = cli(f, []);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.error, undefined);
  assert.match(result.stdout, /EVIDENCIA AUTOMÁTICA VÁLIDA \(smoke, full, lighthouse\)/);
  assert.equal(readJSON(join(f.root, 'summary.json')).automatedApproval, true);
});
test('CLI histórico: código cero informativo y resumen actual intacto', t => {
  const f = fixture(t, true), run = f.create();
  assert.equal(cli(f, ['--profiles', 'smoke']).status, 0);
  const before = readFileSync(join(f.root, 'summary.json'));
  const history = cli(f, ['--history', run.run.runId]);
  assert.equal(history.status, 0); assert.match(history.stdout, /CONSULTA HISTÓRICA INFORMATIVA/);
  assert.match(history.stdout, /"automatedApproval": false/);
  assert.deepEqual(readFileSync(join(f.root, 'summary.json')), before);
});
for (const state of ['running', 'failed', 'interrupted']) test(`CLI real: ${state} rechaza con código uno y causa exacta`, t => {
  const f = fixture(t, true), run = f.create('smoke', false);
  if (state !== 'running') finishRun(f.root, run.run, state, 'Fixture de estado');
  const result = cli(f, ['--profiles', 'smoke']);
  assert.equal(result.status, 1); assert.equal(result.error, undefined);
  assert.match(result.stderr, new RegExp(`SIN APROBACIÓN: Última ejecución smoke: ${state}; sin aprobación`));
  assert.equal(readJSON(join(f.root, 'summary.json')).automatedApproval, false);
});
for (const [name, mutate, expected] of [
  ['resultado ausente', run => rmSync(join(run.directory, 'results.json')), /ENOENT.*results\.json/],
  ['resultado fallido', run => { run.edit('results.json', r => { r.suites[0].specs[0].tests[0].results[0].status = 'failed'; }); resealBytesForTest(run.directory); }, /Resultado fallido o reintentado/],
  ['cobertura parcial', run => { run.edit('results.json', r => { r.suites[0].specs.pop(); }); resealBytesForTest(run.directory); }, /Cobertura incompleta o duplicada/],
  ['identificador incompatible', run => { run.edit('results.json', r => { r.config.metadata.qa.runId = '0'.repeat(36); }); resealBytesForTest(run.directory); }, /Playwright de otra ejecución/],
  ['integridad fallida', run => { run.edit('integrity.json', r => { r.unchanged = false; }); resealBytesForTest(run.directory); }, /Integridad fallida/],
  ['bytes alterados', run => { const path = join(run.directory, 'results.json'); writeFileSync(path, readFileSync(path, 'utf8') + '\n'); }, /Bytes de evidencia alterados: results\.json/],
  ['fuente cambiada', (_, f) => writeFileSync(join(f.cwd, 'src/fixture.ts'), 'export const fixture = false;\n'), /antigua o incompatible con las fuentes\/runtime actuales/],
]) test(`CLI con contexto válido llega al validador: ${name}`, t => {
  const f = fixture(t, true), run = f.create(); mutate(run, f);
  const result = cli(f, ['--profiles', 'smoke']);
  assert.equal(result.status, 1); assert.equal(result.error, undefined);
  assert.match(result.stderr, /SIN APROBACIÓN:/); assert.match(result.stderr, expected);
  assert.doesNotMatch(result.stderr, /not a git repository|Command failed: git/);
  const summary = readJSON(join(f.root, 'summary.json'));
  assert.equal(summary.automatedApproval, false); assert.match(summary.reason, expected);
});
test('CLI con hashes válidos rechaza infracción axe por la causa semántica', t => {
  const f = fixture(t, true), run = f.create(), [, file, mutate] = mutations.find(([name]) => name === 'axe con infracción');
  run.edit(file, mutate); resealBytesForTest(run.directory);
  const result = cli(f, ['--profiles', 'smoke']);
  assert.equal(result.status, 1); assert.match(result.stderr, /SIN APROBACIÓN: Infracciones confirmadas por axe/);
  assert.doesNotMatch(result.stderr, /Bytes de evidencia alterados|not a git repository/);
});
test('CLI Lighthouse rechaza configSettings con hashes válidos', t => {
  const f = fixture(t, true), run = f.create('lighthouse');
  run.edit('inicio-1.json', r => { r.configSettings.formFactor = 'desktop'; }); resealBytesForTest(run.directory);
  const result = cli(f, ['--profiles', 'lighthouse']);
  assert.equal(result.status, 1); assert.match(result.stderr, /SIN APROBACIÓN: Condición efectiva Lighthouse incompatible: formFactor/);
});
test('control de mutación: quitar el guard de axe hace fallar la aserción semántica', t => {
  const f = fixture(t), run = f.create('smoke', false), [, file, mutate, expected] = mutations.find(([name]) => name === 'axe con infracción');
  run.edit(file, mutate); expectSemanticRejection(f, run, expected);
  const path = resolve(repository, 'scripts/qa/results.mjs'), guard = "assert.equal(violations, 0, 'Infracciones confirmadas por axe');";
  const original = readFileSync(path, 'utf8'); assert(original.includes(guard));
  const mutant = 'data:text/javascript;base64,' + Buffer.from(original.replace(guard, '/* Mutante aislado, sin guard axe. */')).toString('base64');
  const execute = module => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import assert from 'node:assert/strict'; import {validateResults} from ${JSON.stringify(module)};
    assert.throws(()=>validateResults(${JSON.stringify(run.directory)},${JSON.stringify(run.run)},${JSON.stringify(binding(run.run))}),/Infracciones confirmadas por axe/);`
  ], { encoding: 'utf8', timeout: 10000 });
  const control = execute(pathToFileURL(path).href); assert.equal(control.status, 0, control.stderr);
  const mutation = execute(mutant); assert.equal(mutation.status, 1);
  assert.match(mutation.stderr, /Missing expected exception/);
  assert.doesNotMatch(mutation.stderr, /Bytes de evidencia alterados/);
});
test('runner real: fallo de preflight antes de pruebas reemplaza evidencia antigua y sale uno', t => {
  const f = fixture(t), old = f.create();
  const result = spawnSync(process.execPath, [resolve(repository, 'scripts/qa/run.mjs'), 'smoke'], { cwd: f.cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a git repository/); // Caso de preflight intencional, distinto de los negativos de evidencia.
  const pointer = readJSON(join(f.root, 'latest/smoke.json'));
  assert.notEqual(pointer.runId, old.run.runId);
  assert.equal(readJSON(join(runDirectory(f.root, pointer.runId), 'run.json')).status, 'failed');
  assert.match(readJSON(join(runDirectory(f.root, pointer.runId), 'run.json')).error, /Command failed: git ls-files/);
  assert.throws(() => check(f), /failed/);
});
test('interrupción: termina el hijo de QA y rechaza la ejecución', async () => {
  const controller = new AbortController();
  const pending = runCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: controller.signal });
  const timer = setTimeout(() => controller.abort(new Error('Interrupción de fixture')), 100);
  try { await assert.rejects(pending, /Interrupción de fixture/); } finally { clearTimeout(timer); }
});
test('contexto real incluye cambios sin commit y es reproducible sin escribir fuentes', () => {
  const a = captureContext(); assert.deepEqual(a, captureContext());
  assert.match(a.sourceHash, /^[a-f0-9]{64}$/); assert.match(a.revision, /^[a-f0-9]{40}$/);
});
test('huella detecta fuentes nuevas sin seguimiento y cambios; excluye salidas y prosa', t => {
  const f = fixture(t);
  assert.equal(spawnSync('git', ['init', '-q', f.cwd]).status, 0); // Fixture sin commits.
  mkdirSync(join(f.cwd, 'src'));
  const empty = captureSourceHash(f.cwd);
  writeFileSync(join(f.cwd, 'src/new.ts'), 'export const a = 1;\n');
  const added = captureSourceHash(f.cwd); assert.notEqual(added, empty);
  writeFileSync(join(f.cwd, 'src/new.ts'), 'export const a = 2;\n');
  const edited = captureSourceHash(f.cwd); assert.notEqual(edited, added);
  mkdirSync(join(f.cwd, 'docs')); writeFileSync(join(f.cwd, 'docs/QA_PHASE_4C.md'), 'Progreso documental');
  mkdirSync(f.root); writeFileSync(join(f.root, 'old.json'), '{}');
  assert.equal(captureSourceHash(f.cwd), edited);
  rmSync(join(f.cwd, 'src/new.ts')); assert.equal(captureSourceHash(f.cwd), empty);
});
test('invocación con argumentos no admitidos también invalida un éxito anterior', t => {
  const f = fixture(t); f.create();
  const result = spawnSync(process.execPath, [resolve(repository, 'scripts/qa/run.mjs'), 'smoke', '--grep', 'algo'], { cwd: f.cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  const pointer = readJSON(join(f.root, 'latest/smoke.json'));
  const run = readJSON(join(runDirectory(f.root, pointer.runId), 'run.json'));
  assert.equal(run.status, 'failed'); assert.match(run.error, /no admite filtros/);
});
