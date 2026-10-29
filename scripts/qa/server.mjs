import { spawn } from 'node:child_process';
export async function startServer() {
  const child = spawn(process.execPath, ['scripts/ci/preview.mjs'], { env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Preview QA no disponible en 30 s')); }, 30000);
    const read = chunk => {
      output += chunk;
      const match = output.match(/RLVO_PREVIEW=(http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', read); child.stderr.on('data', read);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview QA terminó: ${code}\n${output}`)); });
  });
  return { url, async stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
    });
  } };
}
