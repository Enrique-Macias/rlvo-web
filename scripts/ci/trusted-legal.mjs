// Se ejecuta desde la base del PR en un runner separado. No hace checkout del candidato.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import { assertCommit } from './inputs.mjs';
import { git, gitBlob, gitInputs, verifyDraftPolicy, verifyHistoryWithTrustedChecker } from './legal-policy.mjs';
const REPOSITORY = 'Enrique-Macias/rlvo-web';
const CONTROL_CODES = new Set(['CI_CONTEXT', 'CI_REF', 'CI_GIT', 'CI_ANCESTRY', 'CI_TREE', 'CI_BLOB_SIZE',
  'CI_ENTRY_TYPE', 'CI_POLICY_MISSING', 'CI_POLICY_SCHEMA', 'CI_LEGAL_IMMUTABLE', 'CI_AUTH_REQUIRED',
  'CI_AUTH_SCHEMA', 'CI_AUTH_BINDING', 'CI_AUTH_DIGEST', 'CI_AUTH_TIME', 'CI_AUTH_NOT_YET_VALID',
  'CI_AUTH_EXPIRED', 'CI_AUTH_TRANSPORT']);

function decodeAuthorization(value) {
  if (value === undefined || value === '') return undefined;
  const reject = () => {
    const error = new Error('Transporte de autorización inválido'); error.code = 'CI_AUTH_TRANSPORT'; throw error;
  };
  // Límite previo a regex/decodificación; JSON de nueve campos cabe holgadamente.
  if (typeof value !== 'string' || value.length > 8192 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) reject();
  const bytes = Buffer.from(value, 'base64');
  // Buffer.from es permisivo: la recodificación exige también bits de padding canónicos.
  if (bytes.toString('base64') !== value) reject();
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { reject(); }
}

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
function invalidContext(message) {
  const error = new Error(message); error.code = 'CI_EVENT_CONTEXT'; throw error;
}

// No hay sustitución de verificadores mediante opciones, env, imports o código del PR.
export async function verifyTrustedRun(root, { eventName, repository, pullRequest, authorizationBase64, ...references }) {
  if (repository !== REPOSITORY || !['pull_request_target', 'workflow_dispatch'].includes(eventName)) invalidContext('Contexto no admitido');
  if (eventName === 'pull_request_target' && (!Number.isSafeInteger(pullRequest) || pullRequest <= 0)) invalidContext('Número de PR inválido');
  if (eventName === 'workflow_dispatch' && (pullRequest !== null || references.base !== references.candidate)) invalidContext('Diagnóstico manual exige base=candidato y ningún PR');
  assertTrustReferences(root, references);
  const checks = {}, errors = [];
  try {
    // Import literal relativo a ESTE módulo de la base. También se captura un fallo de carga.
    const { inspectControls, verifyControls, verifyCurrentControls } = await import('./control-policy.mjs');
    const context = { root, repository, pullRequest, baseSha: references.base, headSha: references.candidate };
    let controls;
    if (eventName === 'pull_request_target') {
      const inspection = inspectControls(context);
      // Conservar prioridad jurídica e indiferencia al transporte en PR ordinarios.
      // Ambos inspect leen los mismos objetos inmutables; el validador original no cambia.
      const authorization = inspection.changes.length && !inspection.legalChanges.length
        ? decodeAuthorization(authorizationBase64) : undefined;
      controls = verifyControls({ ...context, authorization });
    } else {
      controls = verifyCurrentControls(context);
    }
    checks.controls = { conclusion: 'success', controlIntegrity: controls.controlIntegrity,
      policySha256: controls.policySha256, changesDigest: controls.changesDigest,
      authorizationId: controls.authorization?.authorizationId ?? null };
  } catch (error) {
    // Ni errores internos ni sus códigos pueden volcar un transporte o JSON reconstruido.
    const code = CONTROL_CODES.has(error?.code) ? error.code : 'CI_CONTROL_INTERNAL';
    checks.controls = { conclusion: 'failure', code, message: 'Control de CI rechazado; consultar el código causal' };
    errors.push(error);
  }
  // Se intenta SIEMPRE después de validar contexto/refs, incluso si CI fue rechazado.
  // Ningún registro de mantenimiento puede omitir el checker histórico o drafts-only.
  try {
    checks.legal = { conclusion: 'success', ...await verifyGitCandidate(root, references) };
  } catch (error) {
    checks.legal = { conclusion: 'failure', code: error?.code ?? 'LEGAL_VERIFICATION_FAILED', message: error?.message ?? String(error) };
    errors.push(error);
  }
  if (errors.length) {
    const error = new AggregateError(errors, 'Validación de confianza rechazada; revisar controls y legal');
    error.code = 'CI_TRUST_FAILURE'; error.checks = checks; throw error;
  }
  return { eventName, repository, pullRequest, baseline: references.baseline, base: references.base,
    candidate: references.candidate, checks, mergeApproval: false };
}

export async function runTrustedEntrypoint({ root = process.cwd(), env = process.env } = {}) {
  const authorizationBase64 = env.CI_CONTROL_CHANGE_AUTHORIZATION_B64;
  // Consumir antes del primer proceso hijo. El canal antiguo nunca es una alternativa.
  for (const key of ['CI_CONTROL_CHANGE_AUTHORIZATION_B64', 'CI_CONTROL_CHANGE_AUTHORIZATION']) {
    delete env[key]; delete process.env[key];
  }
  if (env.GITHUB_ACTIONS !== 'true' || !['pull_request_target', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) ||
      env.GITHUB_REPOSITORY !== REPOSITORY) invalidContext('Entrada reservada al job de confianza; para verificación local usar npm run ci:web');
  if (env.GITHUB_REF !== 'refs/heads/main') invalidContext('El control solo se ejecuta desde main; nunca se omite como skipped');
  const baseline = assertCommit(env.LEGAL_BASELINE_SHA), base = assertCommit(env.BASE_SHA), candidate = assertCommit(env.CANDIDATE_SHA);
  let number = null;
  if (env.GITHUB_EVENT_NAME === 'pull_request_target') {
    if (!/^[1-9][0-9]*$/.test(env.PR_NUMBER ?? '') || !Number.isSafeInteger(Number(env.PR_NUMBER))) invalidContext('Número de PR inválido');
    number = Number(env.PR_NUMBER);
    let event;
    try {
      if (!env.GITHUB_EVENT_PATH || statSync(env.GITHUB_EVENT_PATH).size > 2 * 1024 * 1024) invalidContext('Payload del evento ausente o excesivo');
      event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    } catch { invalidContext('Payload de GitHub ausente o inválido'); }
    const pr = event.pull_request;
    if (event.repository?.full_name !== REPOSITORY || pr?.number !== number || pr.base?.ref !== 'main' ||
        pr.base?.repo?.full_name !== REPOSITORY || pr.base?.sha !== base || pr.head?.sha !== candidate) invalidContext('SHA, PR o repositorio no coincide con el evento confiable');
  } else if (base !== candidate || env.GITHUB_SHA !== base || env.PR_NUMBER) {
    invalidContext('workflow_dispatch solo diagnostica main contra sí mismo, sin autorización de cambios');
  }
  if (git(root, ['rev-parse', 'HEAD']).toString().trim() !== base) throw new Error('El checkout del control debe ser la base exacta, nunca el PR');
  // Origen público conocido: no se usa URL, branch, token ni argumentos de comandos aportados por el PR.
  const remote = 'https://github.com/Enrique-Macias/rlvo-web.git';
  git(root, ['fetch', '--no-tags', '--no-recurse-submodules', remote, 'refs/heads/legal-history-baseline:refs/remotes/origin/legal-history-baseline']);
  if (env.GITHUB_EVENT_NAME === 'pull_request_target') {
    git(root, ['fetch', '--no-tags', '--no-recurse-submodules', remote, `refs/pull/${number}/head:refs/remotes/origin/legal-candidate`]);
    if (git(root, ['rev-parse', 'refs/remotes/origin/legal-candidate']).toString().trim() !== candidate) throw new Error('El PR cambió durante el fetch; volver a ejecutar para el nuevo SHA');
  }
  const protectedBaseline = git(root, ['rev-parse', 'refs/remotes/origin/legal-history-baseline']).toString().trim();
  return verifyTrustedRun(root, { baseline, base, candidate, protectedBaseline, repository: env.GITHUB_REPOSITORY,
    eventName: env.GITHUB_EVENT_NAME, pullRequest: number, authorizationBase64 });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) invalidContext('No se admiten argumentos, archivos de autorización o flags de bypass');
    console.log(JSON.stringify({ conclusion: 'success', ...await runTrustedEntrypoint() }));
  } catch (error) {
    console.error(JSON.stringify({ conclusion: 'failure', code: error.code ?? 'TRUST_ENTRY_FAILURE',
      message: error.message, checks: error.checks }));
    process.exitCode = 1;
  }
}
