import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startServer } from '../scripts/qa/server.mjs';
import { runCommand, spawnOwned } from '../scripts/qa/command.mjs';
import { readJSON, writeJSON } from '../scripts/qa/evidence.mjs';

const repository = process.cwd(), cleanup = { graceMs: 100, killMs: 2500 };
const alive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
};
async function until(check, label, timeout = 5000) {
  const deadline = performance.now() + timeout;
  do {
    if (check()) return;
    await delay(20);
  } while (performance.now() < deadline);
  assert.fail(`Timeout de fixture: ${label}`);
}
function fixture(t, { ready = false, stubborn = false, descendants = false } = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'rlvo-qa-process-'))), marker = join(directory, 'pid.json'), term = join(directory, 'term'), leafMarker = join(directory, 'leaf.json');
  const pids = new Set();
  t.after(async () => {
    // Solo PIDs obtenidos de nuestros hijos de prueba; limpieza de respaldo si falla una assertion.
    for (const path of [marker, leafMarker]) if (existsSync(path)) pids.add(readJSON(path).pid);
    for (const pid of pids) if (alive(pid)) process.kill(pid, 'SIGKILL');
    await until(() => [...pids].every(pid => !alive(pid)), 'limpieza de respaldo');
    rmSync(directory, { recursive: true, force: true });
  });
  const leaf = `const fs=require('node:fs'); process.on('SIGTERM',()=>{}); fs.writeFileSync(${JSON.stringify(leafMarker)},JSON.stringify({pid:process.pid})); setInterval(()=>{},1000);`;
  const code = `const fs=require('node:fs');
    ${stubborn ? `process.on('SIGTERM',()=>fs.writeFileSync(${JSON.stringify(term)},'TERM'));` : ''}
    ${descendants ? `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(leaf)}],{stdio:'ignore'});` : ''}
    fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid}));
    ${ready ? "console.log('RLVO_PREVIEW=http://127.0.0.1:12345/');" : ''}
    setInterval(()=>{},1000);`;
  return { directory, marker, term, leafMarker, options: { program: process.execPath, args: ['-e', code], startupMs: 2000, cleanup },
    async pid() { await until(() => existsSync(marker), 'hijo iniciado'); const pid = readJSON(marker).pid; pids.add(pid); return pid; } };
}

test('preview: cancelación anterior al spawn no crea un hijo', { timeout: 5000 }, async t => {
  const controller = new AbortController(), reason = new Error('Cancelado antes del arranque'); controller.abort(reason);
  const spawnMock = t.mock.method(childProcess, 'spawn', () => assert.fail('No debe invocar spawn con señal ya abortada'));
  syncBuiltinESMExports();
  try {
    await assert.rejects(startServer(controller.signal), error => error === reason);
    assert.equal(spawnMock.mock.callCount(), 0);
  } finally { spawnMock.mock.restore(); syncBuiltinESMExports(); }
});
test('preview: cancelación durante arranque espera la salida efectiva', { timeout: 10000 }, async t => {
  const f = fixture(t), controller = new AbortController();
  const pending = startServer(controller.signal, f.options);
  const rejection = assert.rejects(pending, /Cancelado durante arranque/);
  const pid = await f.pid(); controller.abort(new Error('Cancelado durante arranque'));
  await rejection; assert.equal(alive(pid), false);
});
test('preview: hijo ignora SIGTERM durante arranque; escala y espera SIGKILL', { timeout: 10000 }, async t => {
  const f = fixture(t, { stubborn: true }), controller = new AbortController();
  const pending = startServer(controller.signal, f.options), rejection = assert.rejects(pending, /Cancelado con hijo resistente/);
  const pid = await f.pid(); const started = performance.now(); controller.abort(new Error('Cancelado con hijo resistente'));
  await rejection;
  assert(existsSync(f.term), 'El hijo recibió SIGTERM'); assert.equal(alive(pid), false);
  assert(performance.now() - started >= cleanup.graceMs, 'Se respetó el plazo de gracia');
});
test('preview: timeout de arranque también termina y recoge al hijo', { timeout: 10000 }, async t => {
  const f = fixture(t, { stubborn: true });
  const pending = startServer(undefined, { ...f.options, startupMs: 500 });
  const rejection = assert.rejects(pending, /Preview QA no disponible dentro del plazo de arranque/);
  const pid = await f.pid(); await rejection; assert.equal(alive(pid), false); assert(existsSync(f.term));
});
test('preview: cancelar después de ready espera limpieza; stop es idempotente', { timeout: 10000 }, async t => {
  const f = fixture(t, { ready: true, stubborn: true }), controller = new AbortController();
  const server = await startServer(controller.signal, f.options), pid = await f.pid();
  assert.equal(server.url, 'http://127.0.0.1:12345/'); controller.abort(new Error('Cancelado después de ready'));
  const a = server.stop(), b = server.stop(); assert.equal(a, b); await a;
  assert.equal(alive(pid), false);
});
test('preview: stop normal y señal tardía no reabren limpieza ni dejan procesos', { timeout: 10000 }, async t => {
  const f = fixture(t, { ready: true }), controller = new AbortController();
  const server = await startServer(controller.signal, f.options), pid = await f.pid();
  await server.stop(); controller.abort(new Error('Señal tardía')); await server.stop(); assert.equal(alive(pid), false);
});
test('preview: error de spawn conserva ENOENT y no espera indefinidamente', { timeout: 5000 }, async () => {
  await assert.rejects(startServer(undefined, { program: '/rlvo-fixture-no-existe', cleanup }), { code: 'ENOENT' });
});
test('preview: salida temprana informa el código real y limpia recursos', { timeout: 5000 }, async () => {
  await assert.rejects(startServer(undefined, { args: ['-e', 'process.exit(7)'], cleanup }), /Preview QA terminó: código 7, señal null/);
});
test('owned: salida observada confirma el escalamiento a SIGKILL', { timeout: 10000 }, async t => {
  const f = fixture(t, { stubborn: true });
  const owned = spawnOwned(f.options.program, f.options.args, { stdio: 'ignore' }, cleanup);
  t.after(() => owned.stop()); const pid = await f.pid(); await owned.stop();
  assert.equal((await owned.exited).signal, 'SIGKILL'); assert.equal(alive(pid), false);
});
test('preview POSIX: termina también un descendiente que ignora SIGTERM', { timeout: 10000, skip: process.platform === 'win32' }, async t => {
  const f = fixture(t, { ready: true, stubborn: true, descendants: true });
  const server = await startServer(undefined, f.options), pid = await f.pid();
  await until(() => existsSync(f.leafMarker), 'descendiente iniciado'); const leaf = readJSON(f.leafMarker).pid;
  await server.stop(); assert.equal(alive(pid), false); assert.equal(alive(leaf), false);
});
test('comandos: éxito cero y fallo siete conservan su resultado tras limpieza', { timeout: 10000 }, async () => {
  await runCommand(process.execPath, ['-e', 'process.exit(0)'], { cleanup });
  await assert.rejects(runCommand(process.execPath, ['-e', 'process.exit(7)'], { cleanup }), /terminó: código 7, señal null/);
});
test('comandos: limpieza imposible falla dentro de un plazo, sin esperar exit indefinidamente', { timeout: 5000 }, async t => {
  // Simulación estricta de un proceso que el SO no confirma como terminado. Sin procesos reales.
  const child = new EventEmitter(), signals = [], originalKill = process.kill;
  child.pid = 1000000000; child.kill = signal => { signals.push(signal); return true; };
  const spawnMock = t.mock.method(childProcess, 'spawn', () => child);
  const killMock = t.mock.method(process, 'kill', (pid, signal) => {
    if (pid === -child.pid) { signals.push(signal); return true; }
    return originalKill(pid, signal);
  });
  syncBuiltinESMExports();
  try {
    const controller = new AbortController(), started = performance.now();
    const pending = runCommand('fixture-sin-spawn-real', [], { signal: controller.signal, cleanup: { graceMs: 30, killMs: 40 } });
    controller.abort(new Error('Cancelación simulada'));
    await assert.rejects(pending, /Proceso\/grupo QA no terminó después de SIGKILL; limpieza no confirmada/);
    assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']); assert(performance.now() - started < 2000);
  } finally { spawnMock.mock.restore(); killMock.mock.restore(); syncBuiltinESMExports(); }
});

for (const signal of ['SIGINT', 'SIGTERM']) test(`runner real: ${signal} cierra interrupted, sale uno y recoge el build`, { timeout: 20000, skip: process.platform === 'win32' }, async t => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'rlvo-qa-runner-'))), cwd = join(directory, 'repo');
  let runner, buildPid;
  t.after(() => {
    if (runner && runner.exitCode === null && runner.signalCode === null) process.kill(runner.pid, 'SIGKILL');
    if (buildPid && alive(buildPid)) process.kill(buildPid, 'SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  });
  // Checkout local completo para que las fuentes protegidas del HEAD sean reales e intactas.
  execFileSync('git', ['clone', '--shared', '--quiet', '--', repository, cwd]);
  for (const name of ['@playwright/test', '@axe-core/playwright', 'axe-core', 'lighthouse']) {
    mkdirSync(join(cwd, 'node_modules', name), { recursive: true });
    writeJSON(join(cwd, 'node_modules', name, 'package.json'), { version: readJSON(join(repository, 'node_modules', name, 'package.json')).version });
  }
  mkdirSync(join(cwd, 'node_modules/playwright-core'), { recursive: true });
  writeFileSync(join(cwd, 'node_modules/playwright-core/browsers.json'), readFileSync(join(repository, 'node_modules/playwright-core/browsers.json')));
  const marker = join(cwd, 'qa/build-child.json'), pkg = readJSON(join(cwd, 'package.json'));
  mkdirSync(join(cwd, 'qa'), { recursive: true });
  writeFileSync(join(cwd, 'qa/build-fixture.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000);\n`);
  pkg.scripts.prebuild = ''; pkg.scripts.build = 'node qa/build-fixture.mjs';
  writeJSON(join(cwd, 'package.json'), pkg);
  runner = spawn(process.execPath, [resolve(repository, 'scripts/qa/run.mjs'), 'smoke'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; runner.stdout.on('data', data => { output += data; }); runner.stderr.on('data', data => { output += data; });
  const exit = new Promise((resolve, reject) => { runner.once('exit', (code, signal) => resolve({ code, signal })); runner.once('error', reject); });
  await until(() => existsSync(marker), `build iniciado: ${output}`); buildPid = readJSON(marker).pid;
  process.kill(runner.pid, signal);
  let timer;
  const result = await Promise.race([exit, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Runner no terminó tras señal')), 12000); })]).finally(() => clearTimeout(timer));
  assert.deepEqual(result, { code: 1, signal: null }); assert.match(output, new RegExp(`QA interrumpido: ${signal}`));
  const pointer = readJSON(join(cwd, 'qa/latest/smoke.json')), run = readJSON(join(cwd, 'qa/runs', pointer.runId, 'run.json'));
  assert.equal(run.status, 'interrupted'); assert.equal(run.exitCode, 1); assert.match(run.error, new RegExp(`QA interrumpido: ${signal}`));
  assert.equal(alive(buildPid), false);
});
