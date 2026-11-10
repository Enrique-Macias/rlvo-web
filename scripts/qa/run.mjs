import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { captureInputs, assertInputsUnchanged } from '../ci/inputs.mjs';
import { verifyProtectedFiles } from './integrity.mjs';
import { startServer } from './server.mjs';
import { runCommand } from './command.mjs';
import { beginRun, binding, captureContext, finishRun, profiles, runDirectory, saveRun, sealRun, writeJSON } from './evidence.mjs';

const profile = process.argv[2], root = resolve('qa');
if (!profiles.includes(profile)) throw new Error('Uso: npm run qa:smoke | qa:full | qa:lighthouse');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('qa/browsers');
// Registrar la invocación antes de preflight, build o lectura de fuentes protegidas.
const execution = beginRun(root, profile), directory = runDirectory(root, execution.runId);
console.log(`QA ${profile}: ${execution.runId}\nEvidencia: ${directory}`);
const controller = new AbortController();
let interruption, server, before, failure;
const interrupt = signal => { interruption ??= signal; controller.abort(new Error(`QA interrumpido: ${signal}`)); };
const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
try {
  if (process.argv.length !== 3) throw new Error('El perfil QA no admite filtros ni argumentos adicionales');
  execution.context = captureContext(); saveRun(root, execution);
  before = captureInputs(process.cwd());
  const protectedFiles = verifyProtectedFiles();
  await runCommand('npm', ['run', 'build'], { env: { SITE_ENV: 'production' }, signal: controller.signal });
  server = await startServer(controller.signal);
  const env = { QA_BASE_URL: server.url, QA_PROFILE: profile, QA_RUN_ID: execution.runId, QA_CONTEXT_HASH: binding(execution).contextHash };
  await runCommand(process.execPath, profile === 'lighthouse' ? ['scripts/qa/lighthouse.mjs'] : ['node_modules/@playwright/test/cli.js', 'test'], { env, signal: controller.signal });
  await server.stop(); server = undefined;
  controller.signal.throwIfAborted();
  assertInputsUnchanged(before, captureInputs(process.cwd()));
  verifyProtectedFiles();
  assert.deepEqual(captureContext(), execution.context, 'Fuentes o runtime cambiaron durante QA');
  writeJSON(`${directory}/integrity.json`, { qa: binding(execution), protectedFiles, unchanged: true, releases: 0,
    current: { terminos: null, aviso_privacidad: null } });
  sealRun(root, execution);
  controller.signal.throwIfAborted();
} catch (error) {
  failure = error;
} finally {
  try {
    if (server) await server.stop();
    if (before) assertInputsUnchanged(before, captureInputs(process.cwd()));
    verifyProtectedFiles();
  } catch (error) { failure ??= error; }
  finishRun(root, execution, interruption ? 'interrupted' : failure ? 'failed' : 'passed', failure);
  process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
}
if (failure || interruption) {
  console.error(failure?.message ?? interruption);
  process.exitCode = 1;
} else console.log(`QA ${profile}: evidencia completa y sellada. Ejecutar qa:report para verificar vigencia y alcance.`);
