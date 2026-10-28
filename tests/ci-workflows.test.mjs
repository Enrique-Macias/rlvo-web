import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const checkout = 'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd';
const setup = 'actions/setup-node@395ad3262231945c25e8478fd5baf05154b1d79f';
const load = name => {
  const document = parseDocument(readFileSync(`.github/workflows/${name}.yml`, 'utf8'), { uniqueKeys: true });
  assert.deepEqual(document.errors, []); return document.toJS();
};
function secure(workflow, trusted) {
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert(!JSON.stringify(workflow).includes('secrets.'));
  assert(!workflow.on.workflow_run && !workflow.on.repository_dispatch);
  assert.equal(Boolean(workflow.on.pull_request_target), trusted);
  const jobs = Object.values(workflow.jobs); assert.equal(jobs.length, 1);
  const job = jobs[0]; assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 20);
  assert.equal(job.steps.length, 3);
  const [checkoutStep, setupStep, runStep] = job.steps;
  assert.equal(checkoutStep.uses, checkout); assert.equal(setupStep.uses, setup);
  assert.deepEqual(checkoutStep.with, {
    ref: trusted ? '${{ github.event.pull_request.base.sha || github.sha }}' : '${{ github.event.pull_request.head.sha || github.sha }}',
    'fetch-depth': 0, 'persist-credentials': false, submodules: false, lfs: false,
  });
  assert.deepEqual(setupStep.with, { 'node-version': '22.21.1', 'check-latest': false, 'package-manager-cache': false });
  assert.equal(runStep.run, trusted ? 'node scripts/ci/trusted-legal.mjs' : 'node scripts/ci/verify-web.mjs');
  assert(!job.environment && !job.services && !job.container);
}
test('workflows válidos YAML, acciones con SHA documentado, sin privilegios, caches ni despliegues', () => {
  secure(load('web-ci'), false); secure(load('legal-trust'), true);
});
test('control de confianza usa la base y pin externo; no instala ni ejecuta el candidato', () => {
  const workflow = load('legal-trust'); secure(workflow, true);
  assert.equal(workflow.jobs.integrity.env.LEGAL_BASELINE_SHA, '${{ vars.LEGAL_BASELINE_SHA }}');
  assert.deepEqual(workflow.on.pull_request_target.branches, ['main']);
  assert.equal(workflow.jobs.integrity.if, "github.event_name == 'pull_request_target' || github.ref == 'refs/heads/main'");
});
for (const [name, mutate] of [
  ['permisos write', workflow => { workflow.permissions.contents = 'write'; }],
  ['tag mutable de acción', workflow => { workflow.jobs.integrity.steps[0].uses = 'actions/checkout@v6'; }],
  ['checkout del PR en contexto de confianza', workflow => { workflow.jobs.integrity.steps[0].with.ref = '${{ github.event.pull_request.head.sha }}'; }],
  ['credenciales persistentes', workflow => { workflow.jobs.integrity.steps[0].with['persist-credentials'] = true; }],
  ['restauración de cache', workflow => { workflow.jobs.integrity.steps[1].with['package-manager-cache'] = true; }],
  ['ejecución npm en contexto target', workflow => { workflow.jobs.integrity.steps[2].run = 'npm ci'; }],
  ['secretos de deploy', workflow => { workflow.jobs.integrity.env.TOKEN = '${{ secrets.CLOUDFLARE_API_TOKEN }}'; }],
]) test(`auditoría del workflow rechaza ${name}`, () => {
  const workflow = load('legal-trust'); mutate(workflow); assert.throws(() => secure(workflow, true));
});
test('CODEOWNERS protege todos los workflows y el propio archivo; aún requiere configuración remota', () => {
  const codeowners = readFileSync('.github/CODEOWNERS', 'utf8');
  for (const path of ['/.github/', '/scripts/ci/', '/legal/', '/src/content/legal/']) assert(codeowners.includes(`${path} @Enrique-Macias`));
});
