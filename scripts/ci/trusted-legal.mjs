// Se ejecuta desde la base del PR en un runner separado. No hace checkout del candidato.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCommit } from './inputs.mjs';
import { git, gitBlob, gitInputs, verifyDraftPolicy, verifyHistoryWithTrustedChecker } from './legal-policy.mjs';

export function assertTrustReferences(root, { baseline, base, candidate, protectedBaseline }) {
  for (const sha of [baseline, base, candidate, protectedBaseline]) assertCommit(sha);
  if (baseline !== protectedBaseline) throw new Error('El pin no coincide con la rama de baseline; detener y revisar');
  git(root, ['merge-base', '--is-ancestor', baseline, base]);
  git(root, ['merge-base', '--is-ancestor', base, candidate]);
}
export async function verifyGitCandidate(root, { baseline, base, candidate, protectedBaseline }) {
  assertTrustReferences(root, { baseline, base, candidate, protectedBaseline });
  const old = gitInputs(root, baseline), next = gitInputs(root, candidate);
  await verifyHistoryWithTrustedChecker(gitBlob(root, baseline, 'scripts/check-legal-baseline.mjs'), old, next);
  return verifyDraftPolicy(old, next);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_ACTIONS !== 'true' || !['pull_request_target', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME) ||
      process.env.GITHUB_REPOSITORY !== 'Enrique-Macias/rlvo-web') throw new Error('Entrada reservada al job de confianza; para verificación local usar npm run ci:web');
  const baseline = assertCommit(process.env.LEGAL_BASELINE_SHA), base = assertCommit(process.env.BASE_SHA), candidate = assertCommit(process.env.CANDIDATE_SHA);
  const root = process.cwd();
  if (git(root, ['rev-parse', 'HEAD']).toString().trim() !== base) throw new Error('El checkout del control debe ser la base exacta, nunca el PR');
  // Origen público conocido: no se usa URL, branch, token ni argumentos de comandos aportados por el PR.
  const remote = 'https://github.com/Enrique-Macias/rlvo-web.git';
  git(root, ['fetch', '--no-tags', '--no-recurse-submodules', remote, 'refs/heads/legal-history-baseline:refs/remotes/origin/legal-history-baseline']);
  if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
    const number = process.env.PR_NUMBER;
    if (!/^[1-9][0-9]*$/.test(number ?? '')) throw new Error('Número de PR inválido');
    git(root, ['fetch', '--no-tags', '--no-recurse-submodules', remote, `refs/pull/${number}/head:refs/remotes/origin/legal-candidate`]);
    if (git(root, ['rev-parse', 'refs/remotes/origin/legal-candidate']).toString().trim() !== candidate) throw new Error('El PR cambió durante el fetch; volver a ejecutar para el nuevo SHA');
  }
  const protectedBaseline = git(root, ['rev-parse', 'refs/remotes/origin/legal-history-baseline']).toString().trim();
  const result = await verifyGitCandidate(root, { baseline, base, candidate, protectedBaseline });
  console.log(`Política jurídica verificada sobre blobs: ${JSON.stringify(result)}; candidato ${candidate}; baseline ${baseline}. No certifica protección remota ni aprobación jurídica.`);
}
