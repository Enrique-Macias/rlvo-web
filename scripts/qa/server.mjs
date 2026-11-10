import assert from 'node:assert/strict';
import { spawnOwned } from './command.mjs';

// Opciones programáticas para fixtures de proceso; el CLI conserva la preview fija.
export async function startServer(signal, { program = process.execPath, args = ['scripts/ci/preview.mjs'], startupMs = 30000, cleanup } = {}) {
  signal?.throwIfAborted();
  assert(Number.isSafeInteger(startupMs) && startupMs > 0, 'Plazo de arranque inválido');
  const owned = spawnOwned(program, args, { env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }, cleanup);
  const { child } = owned;
  let output = '', resolveReady, rejectReady, stopping;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const stop = () => stopping ??= owned.stop().finally(() => signal?.removeEventListener('abort', abort));
  const abort = () => { rejectReady(signal.reason); stop().catch(() => {}); }; // El caller espera la misma limpieza.
  const read = chunk => {
    output += chunk;
    const match = output.match(/RLVO_PREVIEW=(http:\/\/127\.0\.0\.1:\d+\/)/);
    if (match) resolveReady(match[1]);
  };
  const timer = setTimeout(() => rejectReady(new Error('Preview QA no disponible dentro del plazo de arranque')), startupMs);
  child.stdout.on('data', read); child.stderr.on('data', read);
  owned.exited.then(result => rejectReady(result.error ?? new Error(`Preview QA terminó: código ${result.code}, señal ${result.signal}\n${output}`)));
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const url = await ready;
    signal?.throwIfAborted();
    return { url, stop };
  } catch (error) {
    await stop(); // Nunca perder el manejador de un hijo que todavía está arrancando.
    throw error;
  } finally {
    clearTimeout(timer);
    child.stdout.removeListener('data', read); child.stderr.removeListener('data', read);
  }
}
