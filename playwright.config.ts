import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const profile = process.env.QA_PROFILE ?? 'smoke';
const browsers = ['chromium', 'firefox', 'webkit'] as const;
// Firefox 157/macOS 27: separar app-data de QA del Firefox personal (upstream #42768).
// No se cambia HOME, TCC, la firma ni los bytes del navegador descargado.
const firefoxData = resolve('qa/firefox-appdata');
if (process.platform === 'darwin') mkdirSync(firefoxData, { recursive: true });
const browserOptions = (browserName: typeof browsers[number]) => ({ browserName,
  ...(browserName === 'firefox' && process.platform === 'darwin' ? { launchOptions: { env: { ...process.env, CFFIXED_USER_HOME: firefoxData } } } : {}),
});
if (!process.env.QA_BASE_URL || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(process.env.QA_BASE_URL)) throw new Error('Usar npm run qa:smoke o qa:full: se requiere una preview local propia.');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: 2, retries: 0,
  timeout: 60_000, expect: { timeout: 7000 },
  outputDir: `qa/${profile}/artifacts`,
  reporter: [['list'], ['json', { outputFile: `qa/${profile}/results.json` }], ['html', { outputFolder: `qa/${profile}/html`, open: 'never' }]],
  use: { baseURL: process.env.QA_BASE_URL, locale: 'es-MX', timezoneId: 'America/Monterrey', viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, screenshot: 'only-on-failure', trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: profile === 'full' ? [
    ...browsers.flatMap(browserName => [360, 390, 768, 1280].map(width => ({ name: `${browserName}-${width}`, testMatch: 'matrix.spec.ts', use: { ...browserOptions(browserName), viewport: { width, height: 900 } } }))),
    ...browsers.map(browserName => ({ name: `${browserName}-interactions`, testMatch: 'interactions.spec.ts', use: browserOptions(browserName) })),
  ] : [{ name: 'chromium-smoke', use: { browserName: 'chromium' }, testMatch: ['matrix.spec.ts', 'interactions.spec.ts'] }],
});
