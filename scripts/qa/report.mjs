import { resolve } from 'node:path';
import { captureContext, currentReport, historicalReport, profiles } from './evidence.mjs';

const args = process.argv.slice(2), root = resolve('qa');
try {
  if (args[0] === '--history' && args.length === 2) {
    console.log(JSON.stringify(historicalReport(root, args[1]), null, 2));
    console.log('CONSULTA HISTÓRICA INFORMATIVA; exit 0 no representa aprobación.');
  } else {
    if (args.length && !(args.length === 2 && args[0] === '--profiles')) throw new Error('Uso: qa:report [--profiles smoke,full,lighthouse | --history UUID | --history legacy:full]');
    const selected = args.length ? args[1].split(',') : profiles;
    const report = currentReport(root, selected, captureContext);
    for (const [profile, result] of Object.entries(report.profiles)) console.log(profile, JSON.stringify({ runId: result.run.runId,
      stats: result.stats, projects: result.projects, axeRuns: result.axeRuns, violations: result.violations,
      manualReviewItems: result.manualReview?.length, lighthouse: result.lighthouse?.pages.map(({ path, medians, belowTarget }) => ({ path, medians, belowTarget })) }));
    console.log(`EVIDENCIA AUTOMÁTICA VÁLIDA (${report.scope.join(', ')}). ${report.limits}\nDetalle: qa/summary.json`);
  }
} catch (error) {
  console.error(`SIN APROBACIÓN: ${error.message}`);
  process.exitCode = 1;
}
