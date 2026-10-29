import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'install', 'chromium', 'firefox', 'webkit'], {
  stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? resolve('qa/browsers') },
});
