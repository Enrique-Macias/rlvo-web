import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateResults } from './results.mjs';
import { protectedSources } from './integrity.mjs';

export const profiles = ['smoke', 'full', 'lighthouse'];
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function runDirectory(root, id) {
  assert(uuid.test(id), 'runId inválido');
  return join(root, 'runs', id);
}
export function writeJSON(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  renameSync(temporary, path);
}
// Solo se mantiene durante operaciones síncronas de metadata, nunca durante un build.
function withStateLock(root, fn) {
  mkdirSync(root, { recursive: true });
  const path = join(root, '.state.lock');
  const fd = openSync(path, 'wx'); // Sin fallback ni recuperación automática de un lock abandonado.
  try { return fn(); } finally { closeSync(fd); unlinkSync(path); }
}
export function captureSourceHash(cwd = process.cwd()) {
  const relevant = path => /^(?:src\/|public\/|legal\/|scripts\/|tests\/|brand-reference\/|\.github\/)/.test(path)
    || /^(?:package(?:-lock)?\.json|playwright\.config\.ts|astro\.config\.mjs|tsconfig\.json|wrangler\.jsonc|\.gitignore|\.gitattributes|\.npmrc|\.nvmrc)$/.test(path)
    || /^docs\/(?:PL-016-WEB-INTEGRATION-CONTRACT|LEGAL_FACTS)\.md$/.test(path);
  const paths = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd })
    .toString().split('\0').filter(path => path && relevant(path)))].sort();
  const files = paths.map(path => {
    const absolute = resolve(cwd, path), stat = lstatSync(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Fuente QA no regular: ${path}`);
    return [path, stat.mode & 0o777, digest(readFileSync(absolute))];
  });
  return digest(JSON.stringify(files));
}
export function captureContext(cwd = process.cwd()) {
  const sourceHash = captureSourceHash(cwd);
  const tools = Object.fromEntries(['@playwright/test', '@axe-core/playwright', 'axe-core', 'lighthouse'].map(name =>
    [name, readJSON(join(cwd, 'node_modules', name, 'package.json')).version]));
  return { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd }).toString().trim(), sourceHash,
    runtime: { node: process.version, platform: process.platform, arch: process.arch, tools,
      browsers: { path: resolve(cwd, process.env.PLAYWRIGHT_BROWSERS_PATH ?? 'qa/browsers'),
        descriptorHash: digest(readFileSync(join(cwd, 'node_modules/playwright-core/browsers.json'))) } } };
}
export const contextHash = context => digest(JSON.stringify(context));
export const binding = run => ({ schemaVersion: 1, runId: run.runId, profile: run.profile, contextHash: contextHash(run.context) });
export function beginRun(root, profile) {
  assert(profiles.includes(profile), 'Perfil inválido');
  return withStateLock(root, () => {
    const run = { schemaVersion: 1, runId: randomUUID(), profile, status: 'running', startedAt: new Date().toISOString(),
      finishedAt: null, exitCode: null, context: null };
    mkdirSync(join(root, 'runs'), { recursive: true });
    mkdirSync(runDirectory(root, run.runId));
    mkdirSync(join(root, 'latest'), { recursive: true });
    writeJSON(join(runDirectory(root, run.runId), 'run.json'), run);
    writeJSON(join(root, 'latest', `${profile}.json`), { schemaVersion: 1, profile, runId: run.runId });
    writeJSON(join(root, 'summary.json'), { schemaVersion: 1, status: 'pending', automatedApproval: false,
      reason: `Nueva ejecución ${profile}: ${run.runId}`, generatedAt: new Date().toISOString() });
    return run;
  });
}
export function saveRun(root, run) { writeJSON(join(runDirectory(root, run.runId), 'run.json'), run); }
export function finishRun(root, run, status, error) {
  assert(run.status === 'running', 'La ejecución ya está cerrada');
  assert(['passed', 'failed', 'interrupted'].includes(status), 'Estado final inválido');
  run.status = status;
  run.exitCode = status === 'passed' ? 0 : 1;
  run.finishedAt = new Date().toISOString();
  if (error) run.error = String(error.message ?? error);
  saveRun(root, run);
}
export function validateManifest(run, id) {
  assert.equal(run.schemaVersion, 1, 'Esquema de ejecución no admitido');
  assert(uuid.test(id) && run.runId === id && profiles.includes(run.profile), 'Identidad de ejecución inválida');
  assert(['running', 'passed', 'failed', 'interrupted'].includes(run.status), 'Estado desconocido');
  assert(Number.isFinite(Date.parse(run.startedAt)), 'Inicio ausente');
  if (run.status === 'running') assert(run.finishedAt === null && run.exitCode === null, 'Ejecución abierta incoherente');
  else assert(Number.isFinite(Date.parse(run.finishedAt)) && Date.parse(run.finishedAt) >= Date.parse(run.startedAt)
    && run.exitCode === (run.status === 'passed' ? 0 : 1), 'Cierre incoherente');
}
export function validateData(directory, run) {
  const integrity = readJSON(join(directory, 'integrity.json'));
  assert.deepEqual(integrity.qa, binding(run), 'Integridad de otra ejecución');
  assert.equal(integrity.protectedFiles, protectedSources.length, 'Cobertura protegida inesperada');
  assert.equal(integrity.unchanged, true, 'Integridad fallida');
  assert.equal(integrity.releases, 0, 'Se requieren borradores sin releases');
  assert.deepEqual(integrity.current, { terminos: null, aviso_privacidad: null });
  return validateResults(directory, run, binding(run));
}
export function sealRun(root, run) {
  const directory = runDirectory(root, run.runId);
  const result = validateData(directory, run);
  const files = Object.fromEntries([...result.files, 'integrity.json'].sort().map(path => {
    assert(lstatSync(join(directory, path)).isFile() && !lstatSync(join(directory, path)).isSymbolicLink(), 'Evidencia no regular');
    return [path, digest(readFileSync(join(directory, path)))];
  }));
  writeJSON(join(directory, 'evidence.json'), { qa: binding(run), files });
  return result;
}
export function validateCurrentRun(root, profile, context) {
  const pointer = readJSON(join(root, 'latest', `${profile}.json`));
  assert(pointer.schemaVersion === 1 && pointer.profile === profile, 'Puntero incompatible');
  const directory = runDirectory(root, pointer.runId), run = readJSON(join(directory, 'run.json'));
  validateManifest(run, pointer.runId);
  assert.equal(run.profile, profile, 'Perfil incompatible');
  assert.equal(run.status, 'passed', `Última ejecución ${profile}: ${run.status}; sin aprobación`);
  assert.deepEqual(run.context, context, `Evidencia ${profile} antigua o incompatible con las fuentes/runtime actuales`);
  const seal = readJSON(join(directory, 'evidence.json'));
  assert.deepEqual(seal.qa, binding(run), 'Sello de otra ejecución');
  const result = validateData(directory, run);
  const expected = [...result.files, 'integrity.json'].sort();
  assert.deepEqual(Object.keys(seal.files).sort(), expected, 'Archivos sellados incompletos');
  for (const path of expected) {
    const absolute = join(directory, path);
    assert(lstatSync(absolute).isFile() && !lstatSync(absolute).isSymbolicLink(), 'Evidencia no regular');
    assert.equal(digest(readFileSync(absolute)), seal.files[path], `Bytes de evidencia alterados: ${path}`);
  }
  return { run, ...result.summary };
}
export function currentReport(root, selected, context) {
  return withStateLock(root, () => {
    try {
      assert(selected.length > 0 && new Set(selected).size === selected.length && selected.every(p => profiles.includes(p)), 'Perfiles inválidos');
      const captured = typeof context === 'function' ? context() : context;
      const results = Object.fromEntries(selected.map(profile => [profile, validateCurrentRun(root, profile, captured)]));
      if (typeof context === 'function') assert.deepEqual(context(), captured, 'Fuentes cambiaron durante el reporte');
      const report = { schemaVersion: 1, status: 'valid', automatedApproval: true, scope: selected, context: captured,
        generatedAt: new Date().toISOString(), profiles: results,
        limits: 'Solo evidencia automática del alcance indicado. No aprueba revisión humana, WCAG completo, asuntos jurídicos ni publicación.' };
      writeJSON(join(root, 'summary.json'), report);
      return report;
    } catch (error) {
      writeJSON(join(root, 'summary.json'), { schemaVersion: 1, status: 'invalid', automatedApproval: false,
        generatedAt: new Date().toISOString(), reason: error.message });
      throw error;
    }
  });
}
export function historicalReport(root, id) {
  if (id.startsWith('legacy:')) {
    const profile = id.slice(7);
    assert(profiles.includes(profile), 'Perfil histórico inválido');
    const directory = join(root, profile);
    assert(existsSync(directory), 'Histórico ausente');
    return { mode: 'historical', automatedApproval: false, legacy: true, profile,
      run: existsSync(join(directory, 'run.json')) ? readJSON(join(directory, 'run.json')) : null,
      warning: 'Evidencia previa al contrato: no verificable; consultar sus archivos originales.' };
  }
  const directory = runDirectory(root, id), run = readJSON(join(directory, 'run.json'));
  validateManifest(run, id);
  return { mode: 'historical', automatedApproval: false, run,
    sealedFiles: existsSync(join(directory, 'evidence.json')) ? readJSON(join(directory, 'evidence.json')).files : null,
    warning: 'Consulta informativa; no valida vigencia, integridad de resultados ni aprobación automática.' };
}
