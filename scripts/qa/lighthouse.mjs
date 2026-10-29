import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.QA_BASE_URL;
if (!origin || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(origin)) throw new Error('Lighthouse solo sobre la preview local propia');
const output = 'qa/lighthouse'; mkdirSync(output, { recursive: true });
const settings = { onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: 'mobile', throttlingMethod: 'simulate',
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1, disabled: false },
  throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 }, maxWaitForLoad: 45000 };
const summary = { node: process.version, platform: `${process.platform}/${process.arch}`, conditions: settings,
  analytics: 'Beacon original sin interceptar en Lighthouse; E2E sí aísla requests externos. Sin cambios de HTML o instrumentación.',
  target: 95, blockingThreshold: false, pages: [] };
for (const [slug, path] of [['inicio', '/'], ['contacto', '/contacto'], ['soporte', '/soporte']]) {
  const runs = [];
  for (let run = 1; run <= 3; run++) {
    const profile = mkdtempSync(join(tmpdir(), 'rlvo-lighthouse-'));
    let browser;
    try {
      browser = await chromium.launchPersistentContext(profile, { headless: true, args: ['--remote-debugging-port=0'] });
      const port = +readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      const result = await lighthouse(new URL(path, origin).href, { port, logLevel: 'error', output: ['json', 'html'] }, { extends: 'lighthouse:default', settings });
      if (!result || result.lhr.runtimeError) throw new Error(JSON.stringify(result?.lhr.runtimeError ?? 'Lighthouse sin resultado'));
      const stem = `${output}/${slug}-${run}`;
      writeFileSync(`${stem}.json`, result.report[0]); writeFileSync(`${stem}.html`, result.report[1]);
      const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([key, value]) => [key, Math.round(value.score * 100)]));
      runs.push({ run, scores, lighthouseVersion: result.lhr.lighthouseVersion, userAgent: result.lhr.userAgent, warnings: result.lhr.runWarnings,
        metrics: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'].map(id => [id, result.lhr.audits[id]?.numericValue])),
        findings: Object.entries(result.lhr.audits).filter(([, audit]) => audit.score !== null && audit.score < 1).map(([id, audit]) => ({ id, title: audit.title, score: audit.score, displayValue: audit.displayValue })) });
      console.log(`${slug} ${run}/3: ${JSON.stringify(scores)}`);
      writeFileSync(`${output}/partial.json`, JSON.stringify({ ...summary, current: { slug, runs } }, null, 2) + '\n');
    } finally { if (browser) await browser.close(); rmSync(profile, { recursive: true, force: true }); }
  }
  const medians = Object.fromEntries(Object.keys(runs[0].scores).map(category => [category, runs.map(run => run.scores[category]).sort((a, b) => a - b)[1]]));
  summary.pages.push({ path, runs, medians, belowTarget: Object.entries(medians).filter(([, value]) => value < 95).map(([category, score]) => ({ category, score })) });
}
writeFileSync(`${output}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log('Medianas Lighthouse:', JSON.stringify(summary.pages.map(({ path, medians, belowTarget }) => ({ path, medians, belowTarget }))));
