import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { captureInputs, assertInputsUnchanged } from '../ci/inputs.mjs';
import { verifyProtectedFiles } from './integrity.mjs';
import { startServer } from './server.mjs';
const profile = process.argv[2];
if (!['smoke', 'full', 'lighthouse'].includes(profile) || process.argv.length !== 3) throw new Error('Uso: npm run qa:smoke | qa:full | qa:lighthouse');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('qa/browsers');
const before = captureInputs(process.cwd());
const protectedFiles = verifyProtectedFiles();
const startedAt = new Date().toISOString();
mkdirSync(`qa/${profile}`, { recursive: true });
rmSync(`qa/${profile}/integrity.json`, { force: true });
writeFileSync(`qa/${profile}/run.json`, JSON.stringify({ profile, startedAt, status: 'running' }, null, 2) + '\n');
const run = (program, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(program, args, { env: { ...process.env, ...env }, stdio: 'inherit' });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${program} terminó con código ${code}`)));
});
let server, passed = false;
try {
  await run('npm', ['run', 'build']);
  server = await startServer();
  const env = { QA_BASE_URL: server.url, QA_PROFILE: profile };
  if (profile === 'lighthouse') await run(process.execPath, ['scripts/qa/lighthouse.mjs'], env);
  else await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], env);
  passed = true;
} finally {
  let integrityPassed = false;
  try {
    if (server) await server.stop();
    assertInputsUnchanged(before, captureInputs(process.cwd()));
    verifyProtectedFiles();
    writeFileSync(`qa/${profile}/integrity.json`, JSON.stringify({ protectedFiles, unchanged: true, releases: 0, current: { terminos: null, aviso_privacidad: null } }, null, 2) + '\n');
    integrityPassed = true;
    console.log(`Integridad QA: ${protectedFiles} fuentes protegidas y ${Object.keys(before).length} inputs sin alteraciones.`);
  } finally {
    writeFileSync(`qa/${profile}/run.json`, JSON.stringify({ profile, startedAt, finishedAt: new Date().toISOString(), status: passed && integrityPassed ? 'passed' : 'failed' }, null, 2) + '\n');
  }
}
