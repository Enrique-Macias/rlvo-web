import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertCommit, captureInputs, assertInputsUnchanged, workingInputs } from './inputs.mjs';
import { gitBlob, gitInputs, verifyDraftPolicy, verifyHistoryWithTrustedChecker } from './legal-policy.mjs';

const root = process.cwd();
const baseline = assertCommit(process.env.LEGAL_BASELINE_REF);
let directory;
let preview;
async function stopPreview() {
  const child = preview; preview = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
function run(args) {
  try { execFileSync('npm', args, { cwd: root, stdio: 'inherit' }); }
  finally { assertInputsUnchanged(before, captureInputs(root)); }
}
async function checkHttp() {
  // Puerto efímero: no se comprueba por error un servidor viejo en un puerto fijo.
  preview = spawn(process.execPath, ['scripts/ci/preview.mjs'],
    { cwd: root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ASTRO_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const origin = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Preview local no disponible en 20 s')), 20000);
    const consume = chunk => {
      output += chunk.toString(); process.stdout.write(chunk);
      const match = output.match(/RLVO_PREVIEW=(http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    preview.stdout.on('data', consume); preview.stderr.on('data', consume);
    preview.once('error', error => { clearTimeout(timer); reject(error); });
    preview.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview terminó antes de estar lista: ${code}`)); });
  });
  try { run(['run', 'test:legal:http', '--', origin]); } finally { await stopPreview(); }
}
if (process.versions.node !== '22.21.1' || execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim() !== '10.9.4') throw new Error('CI reproducible requiere Node 22.21.1 y npm 10.9.4 (revisar pins mediante aprobación)');
const before = captureInputs(root);
directory = mkdtempSync(join(tmpdir(), 'rlvo-web-ci-'));
writeFileSync(join(directory, 'inputs-before.json'), JSON.stringify(before, null, 2) + '\n');
try {
  const old = gitInputs(root, baseline);
  await verifyHistoryWithTrustedChecker(gitBlob(root, baseline, 'scripts/check-legal-baseline.mjs'), old, workingInputs(root));
  verifyDraftPolicy(old, workingInputs(root));
  run(['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  run(['run', 'test:ci']);
  run(['run', 'normalize:legal']);
  run(['run', 'test:legal']);
  run(['run', 'check']);
  run(['run', 'build:preview']);
  await checkHttp();
  run(['run', 'build']);
  await checkHttp();
  verifyDraftPolicy(old, workingInputs(root));
  assertInputsUnchanged(before, captureInputs(root));
  console.log(`${Object.keys(before).length} entradas vigiladas: SHA-256, tamaño, modo, inode, dispositivo, mtime y ctime intactos.`);
  console.log('CI local completa: instalación desde lock, pruebas, check, ambos builds/auditorías, HTTP y ausencia de reescrituras verificados. Sin deploy ni aprobación jurídica.');
} finally {
  await stopPreview();
  rmSync(directory, { recursive: true, force: true });
}
