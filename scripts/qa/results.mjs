import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const matrixTitles = ['inicio', 'terminos', 'privacidad', 'soporte', 'contacto', 'eliminar-cuenta', '404'].map(page => `matrix: ${page}`);
export const interactionTitles = [
  'teclado: skip link, navegación móvil, footer y retorno a inicio',
  'teclado: orden, foco visible y ausencia de trampas',
  'soporte: details funciona por teclado y conserva semántica al expandir',
  'documentos: índice y descargas conservan los bytes y hashes canónicos',
  'reflow, texto al 200% y reduced motion',
];
const engines = ['chromium', 'firefox', 'webkit'];
export function expectedCoverage(profile) {
  if (profile === 'smoke') return { 'chromium-smoke': [...matrixTitles, ...interactionTitles] };
  return Object.fromEntries(engines.flatMap(engine => [
    ...[360, 390, 768, 1280].map(width => [`${engine}-${width}`, matrixTitles]),
    [`${engine}-interactions`, interactionTitles],
  ]));
}
const walk = suite => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(walk)];
const withinRun = (time, run) => Number.isFinite(Date.parse(time)) && Date.parse(time) >= Date.parse(run.startedAt)
  && Date.parse(time) <= Date.parse(run.finishedAt ?? new Date().toISOString());
export function validateResults(directory, run, qa) {
  if (run.profile === 'lighthouse') return validateLighthouse(directory, run, qa);
  const source = read(join(directory, 'results.json'));
  assert.deepEqual(source.config.metadata.qa, qa, 'Playwright de otra ejecución');
  assert.equal(source.config.version, run.context.runtime.tools['@playwright/test'], 'Versión de Playwright incompatible');
  assert(withinRun(source.stats.startTime, run), 'Resultados Playwright anteriores a la ejecución');
  assert.deepEqual(source.errors, [], 'Errores globales de Playwright');
  const expected = expectedCoverage(run.profile), actual = {}, projects = {}, incomplete = new Map();
  assert.deepEqual(source.config.projects.map(p => p.name).sort(), Object.keys(expected).sort(), 'Proyectos incompletos');
  let axeRuns = 0, violations = 0, targetSizeEvaluated = 0;
  for (const spec of walk(source)) for (const test of spec.tests) {
    const project = test.projectName;
    assert(expected[project]?.includes(spec.title), 'Caso o proyecto inesperado');
    assert.equal(basename(spec.file), matrixTitles.includes(spec.title) ? 'matrix.spec.ts' : 'interactions.spec.ts', 'Archivo de caso inesperado');
    (actual[project] ??= []).push(spec.title);
    assert.equal(test.expectedStatus, 'passed', 'Caso omitido o con fallo esperado');
    assert.equal(test.status, 'expected', 'Caso fallido, flaky u omitido');
    assert.equal(test.results.length, 1, 'Se requieren resultados sin retries');
    const result = test.results[0];
    assert(result.status === 'passed' && result.retry === 0 && result.errors.length === 0, 'Resultado fallido o reintentado');
    assert(withinRun(result.startTime, run), 'Caso de otra ejecución temporal');
    const counts = projects[project] ??= { passed: 0, failed: 0, skipped: 0 }; counts.passed++;
    const requiredAxe = matrixTitles.includes(spec.title) ? 'axe' : spec.title === interactionTitles[2] ? 'axe-expanded' : null;
    const attachments = (result.attachments ?? []).filter(a => ['axe', 'axe-expanded'].includes(a.name));
    assert.equal(attachments.length, requiredAxe ? 1 : 0, 'Evidencia axe ausente o inesperada');
    if (requiredAxe) {
      const attachment = attachments[0];
      assert(attachment.name === requiredAxe && typeof attachment.body === 'string', 'axe debe estar embebido en el reporte sellado');
      const axe = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
      for (const key of ['passes', 'incomplete', 'violations', 'inapplicable']) assert(Array.isArray(axe[key]), `axe sin ${key}`);
      assert.equal(axe.testEngine.version, run.context.runtime.tools['axe-core'], 'Versión de axe incompatible');
      axeRuns++; violations += axe.violations.length;
      const targetSize = [...axe.passes, ...axe.incomplete, ...axe.violations, ...axe.inapplicable].some(rule => rule.id === 'target-size');
      assert(targetSize, 'Falta evaluación de target-size'); targetSizeEvaluated++;
      for (const rule of axe.incomplete) for (const node of rule.nodes) {
        const key = JSON.stringify([spec.title, rule.id, node.target]);
        const item = incomplete.get(key) ?? { page: spec.title, rule: rule.id, target: node.target, reason: node.failureSummary, projects: [] };
        item.projects.push(project); incomplete.set(key, item);
      }
    }
  }
  for (const project of Object.keys(expected)) assert.deepEqual(actual[project]?.sort(), [...expected[project]].sort(), `Cobertura incompleta o duplicada: ${project}`);
  const count = Object.values(expected).flat().length;
  assert(source.stats.expected === count && source.stats.skipped === 0 && source.stats.unexpected === 0 && source.stats.flaky === 0, 'Estadísticas incompletas o fallidas');
  assert.equal(violations, 0, 'Infracciones confirmadas por axe');
  return { files: ['results.json'], summary: { stats: source.stats, projects, axeRuns, violations, targetSizeEvaluated,
    manualReview: [...incomplete.values()] } };
}

export const lighthouseSettings = { onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile', throttlingMethod: 'simulate',
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
  throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }, maxWaitForLoad: 45000 };
export const lighthousePages = [['inicio', '/'], ['contacto', '/contacto'], ['soporte', '/soporte']];
function validateLighthouse(directory, run, qa) {
  const summary = read(join(directory, 'summary.json')), files = ['summary.json'];
  assert.deepEqual(summary.qa, qa, 'Lighthouse de otra ejecución');
  assert.deepEqual(summary.conditions, lighthouseSettings, 'Condiciones Lighthouse incompatibles');
  assert(summary.target === 95 && summary.blockingThreshold === false, 'Política Lighthouse incompatible');
  assert.deepEqual(summary.pages.map(page => page.path), lighthousePages.map(([, path]) => path), 'Páginas Lighthouse incompletas');
  for (const [index, [slug, path]] of lighthousePages.entries()) {
    const page = summary.pages[index];
    assert.deepEqual(page.runs.map(result => result.run), [1, 2, 3], 'Se requieren tres mediciones por página');
    for (const measurement of page.runs) {
      const stem = `${slug}-${measurement.run}`, lhr = read(join(directory, `${stem}.json`));
      assert.deepEqual(lhr.qa, qa, 'Medición Lighthouse de otra ejecución');
      assert(!lhr.runtimeError && withinRun(lhr.fetchTime, run), 'Lighthouse fallido o antiguo');
      assert.equal(lhr.lighthouseVersion, run.context.runtime.tools.lighthouse, 'Versión Lighthouse incompatible');
      const effective = lhr.configSettings;
      assert(effective && typeof effective === 'object', 'Condiciones efectivas Lighthouse ausentes');
      for (const key of ['onlyCategories', 'formFactor', 'throttlingMethod', 'screenEmulation', 'maxWaitForLoad']) {
        assert.deepEqual(effective[key], summary.conditions[key], `Condición efectiva Lighthouse incompatible: ${key}`);
      }
      for (const [key, value] of Object.entries(summary.conditions.throttling)) {
        assert.equal(effective.throttling?.[key], value, `Throttling efectivo Lighthouse incompatible: ${key}`);
      }
      const url = new URL(lhr.requestedUrl);
      assert(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === path, 'URL Lighthouse incompatible');
      const scores = Object.fromEntries(lighthouseSettings.onlyCategories.map(category => {
        const score = lhr.categories[category]?.score;
        assert(typeof score === 'number' && score >= 0 && score <= 1, 'Categoría Lighthouse ausente');
        return [category, Math.round(score * 100)];
      }));
      assert.deepEqual(measurement.scores, scores, 'Resumen distinto de medición Lighthouse');
      files.push(`${stem}.json`, `${stem}.html`);
    }
    const medians = Object.fromEntries(lighthouseSettings.onlyCategories.map(category => [category, page.runs.map(result => result.scores[category]).sort((a, b) => a - b)[1]]));
    assert.deepEqual(page.medians, medians, 'Medianas incoherentes');
    assert.deepEqual(page.belowTarget, Object.entries(medians).filter(([, score]) => score < 95).map(([category, score]) => ({ category, score })), 'Resultados inferiores ocultos');
  }
  return { files, summary: { lighthouse: summary } };
}
