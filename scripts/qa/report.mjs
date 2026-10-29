import { readFileSync, writeFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const suites = suite => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(suites)];
const report = { generatedAt: new Date().toISOString(), profiles: {} };
for (const profile of ['smoke', 'full']) {
  const source = read(`qa/${profile}/results.json`);
  const projects = {}, incomplete = new Map();
  let axeRuns = 0, violations = 0, targetSizeEvaluated = 0;
  for (const spec of suites(source)) for (const test of spec.tests) {
    const counts = projects[test.projectName] ??= { passed: 0, failed: 0, skipped: 0 };
    counts[test.status === 'expected' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed']++;
    for (const result of test.results) for (const attachment of result.attachments ?? []) {
      if (!['axe', 'axe-expanded'].includes(attachment.name)) continue;
      const axe = JSON.parse(attachment.body ? Buffer.from(attachment.body, 'base64').toString() : readFileSync(attachment.path, 'utf8'));
      axeRuns++; violations += axe.violations.length;
      if ([...axe.passes, ...axe.incomplete, ...axe.violations, ...axe.inapplicable].some(rule => rule.id === 'target-size')) targetSizeEvaluated++;
      for (const rule of axe.incomplete) for (const node of rule.nodes) {
        const key = JSON.stringify([spec.title, rule.id, node.target]);
        const item = incomplete.get(key) ?? { page: spec.title, rule: rule.id, target: node.target, reason: node.failureSummary, projects: [] };
        item.projects.push(test.projectName); incomplete.set(key, item);
      }
    }
  }
  report.profiles[profile] = { run: read(`qa/${profile}/run.json`), stats: source.stats, projects, axeRuns, violations, targetSizeEvaluated,
    manualReview: [...incomplete.values()], integrity: read(`qa/${profile}/integrity.json`) };
}
report.lighthouse = read('qa/lighthouse/summary.json');
writeFileSync('qa/summary.json', JSON.stringify(report, null, 2) + '\n');
for (const [profile, result] of Object.entries(report.profiles)) console.log(profile, JSON.stringify({ stats: result.stats, projects: result.projects, axeRuns: result.axeRuns, violations: result.violations, targetSizeEvaluated: result.targetSizeEvaluated, manualReviewItems: result.manualReview.length }));
console.log('Lighthouse', JSON.stringify(report.lighthouse.pages.map(({ path, medians, belowTarget }) => ({ path, medians, belowTarget }))));
console.log('Detalle y pendientes de axe: qa/summary.json');
