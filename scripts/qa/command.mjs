import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

// El grupo pertenece exclusivamente a este hijo. No se descubren ni matan otros procesos.
export function spawnOwned(program, args, options, { graceMs = 5000, killMs = 3000 } = {}) {
  assert([graceMs, killMs].every(ms => Number.isSafeInteger(ms) && ms > 0), 'Plazos de limpieza inválidos');
  const grouped = process.platform !== 'win32';
  const child = spawn(program, args, { ...options, detached: grouped });
  let ended = false, stopping;
  const exited = new Promise(resolve => {
    child.once('error', error => { ended = true; resolve({ error }); });
    child.once('exit', (code, signal) => { ended = true; resolve({ code, signal }); });
  });
  const send = signal => {
    if (!child.pid) return;
    try { if (grouped) process.kill(-child.pid, signal); else if (!ended) child.kill(signal); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const groupAlive = () => {
    if (!child.pid) return false;
    if (!grouped) return !ended;
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  const waitStopped = async milliseconds => {
    const deadline = performance.now() + milliseconds;
    do {
      if (ended && !groupAlive()) return true;
      await delay(Math.min(25, Math.max(1, deadline - performance.now())));
    } while (performance.now() < deadline);
    return ended && !groupAlive();
  };
  const stop = () => stopping ??= (async () => {
    send('SIGTERM');
    if (await waitStopped(graceMs)) return;
    send('SIGKILL');
    if (!await waitStopped(killMs)) throw new Error('Proceso/grupo QA no terminó después de SIGKILL; limpieza no confirmada');
  })();
  return { child, exited, stop };
}

export async function runCommand(program, args, { env = {}, signal, cleanup } = {}) {
  signal?.throwIfAborted();
  const owned = spawnOwned(program, args, { env: { ...process.env, ...env }, stdio: 'inherit' }, cleanup);
  let abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => { owned.stop().then(() => reject(signal.reason), reject); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
  try {
    const result = await Promise.race([owned.exited, cancelled]);
    signal?.throwIfAborted();
    if (result.error) throw result.error;
    if (result.code !== 0) throw new Error(`${program} terminó: código ${result.code}, señal ${result.signal}`);
  } finally {
    try { await owned.stop(); } finally { signal?.removeEventListener('abort', abort); }
  }
  signal?.throwIfAborted();
}
