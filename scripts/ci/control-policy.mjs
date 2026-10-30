// Biblioteca independiente. El futuro llamador debe proceder de la base confiable.
// Sin CLI, red, checkout, npm, imports del candidato ni escrituras Git/filesystem.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const POLICY_PATH = 'ci/control-policy.json';
export const REPOSITORY = 'Enrique-Macias/rlvo-web';
export const MAX_AUTHORIZATION_MS = 24 * 60 * 60 * 1000;
const MAX_BLOB = 4 * 1024 * 1024;
const MAX_TOTAL = 64 * 1024 * 1024;
const LEGAL_DIRECTORIES = ['legal', 'src/content/legal'];
const LEGAL_FILES = ['src/config/legal-current.json', 'docs/PL-016-WEB-INTEGRATION-CONTRACT.md',
  'docs/LEGAL_FACTS.md', 'src/content/legal.ts', 'src/pages/eliminar-cuenta.astro', 'src/config/site.ts'];
const POLICY_KEYS = ['schemaVersion', 'repository', 'criticalDirectories', 'criticalFiles',
  'criticalFilePrefixes', 'nonAuthorizableDirectories', 'nonAuthorizableFiles'];
const AUTH_KEYS = ['schemaVersion', 'repository', 'pullRequest', 'baseSha', 'headSha',
  'changesDigest', 'authorizationId', 'issuedAt', 'expiresAt'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export class ControlPolicyError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.name = 'ControlPolicyError'; this.code = code; }
}
function requireValue(condition, code, message) {
  if (!condition) throw new ControlPolicyError(code, message);
}
function exactKeys(value, keys, code) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), code, 'Campos no admitidos o ausentes');
}
function commit(value) {
  requireValue(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value), 'CI_REF', 'Se requiere SHA completo; sin fallback');
}
function validPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024 &&
    !/[\x00-\x1f\x7f\\]/.test(value) && !value.startsWith('/') &&
    !value.split('/').some(part => !part || part === '.' || part === '..');
}
function validatePolicy(policy) {
  exactKeys(policy, POLICY_KEYS, 'CI_POLICY_SCHEMA');
  requireValue(policy.schemaVersion === 1 && policy.repository === REPOSITORY,
    'CI_POLICY_SCHEMA', 'Versión o repositorio de política inválido');
  for (const key of POLICY_KEYS.slice(2)) {
    const paths = policy[key];
    requireValue(Array.isArray(paths) && paths.length <= 128 && paths.every(validPath) &&
      new Set(paths).size === paths.length, 'CI_POLICY_SCHEMA', `Lista de rutas inválida: ${key}`);
  }
  // Un registro de mantenimiento nunca puede reducir el piso jurídico del módulo confiable.
  requireValue(LEGAL_DIRECTORIES.every(p => policy.nonAuthorizableDirectories.includes(p)) &&
    LEGAL_FILES.every(p => policy.nonAuthorizableFiles.includes(p)), 'CI_POLICY_SCHEMA', 'Falta el piso jurídico obligatorio');
  requireValue(policy.criticalFiles.includes(POLICY_PATH) && policy.criticalDirectories.includes('scripts/ci') &&
    policy.criticalDirectories.includes('.github'), 'CI_POLICY_SCHEMA', 'La política debe proteger su propia raíz de ejecución');
}
function git(root, args, { input, maxBuffer = 16 * 1024 * 1024 } = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  Object.assign(env, { GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' });
  try {
    return execFileSync('git', ['--no-replace-objects', '-C', root, ...args],
      { env, input, maxBuffer, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    throw new ControlPolicyError('CI_GIT', `No se pudo leer/verificar Git: ${args[0]}`);
  }
}
function readTree(root, reference) {
  requireValue(git(root, ['cat-file', '-t', reference]).toString().trim() === 'commit', 'CI_REF', 'El objeto no es commit');
  let lines;
  try { lines = new TextDecoder('utf-8', { fatal: true }).decode(git(root, ['ls-tree', '-r', '-z', reference])).split('\0'); }
  catch (error) { if (error instanceof ControlPolicyError) throw error; throw new ControlPolicyError('CI_TREE', 'Árbol no UTF-8'); }
  const tree = new Map();
  requireValue(lines.pop() === '' && lines.length <= 50000, 'CI_TREE', 'Árbol incompleto o excesivo');
  for (const line of lines) {
    const match = line.match(/^([0-7]{6}) (blob|commit) ([a-f0-9]{40})\t(.+)$/u);
    requireValue(match && validPath(match[4]) && !tree.has(match[4]), 'CI_TREE', 'Entrada Git no admitida');
    tree.set(match[4], { mode: match[1], type: match[2], oid: match[3] });
  }
  return tree;
}
function regular(entry, path) {
  requireValue(entry.type === 'blob' && ['100644', '100755'].includes(entry.mode),
    'CI_ENTRY_TYPE', `Symlink, gitlink o modo no admitido: ${path}`);
}
function coverage(path, directories, files, prefixes = []) {
  return directories.some(p => path === p || path.startsWith(`${p}/`)) || files.includes(path) ||
    prefixes.some(p => path.startsWith(p)) ||
    [...directories, ...files, ...prefixes].some(p => p.startsWith(`${path}/`));
}

/** Solo informa diferencias. No constituye aprobación y no ejecuta verificadores jurídicos. */
function inspectContext({ root, repository, pullRequest, baseSha, headSha }, currentBase = false) {
  requireValue(typeof root === 'string' && root.length > 0 && !root.includes('\0'), 'CI_CONTEXT', 'Repositorio local inválido');
  requireValue(repository === REPOSITORY && (currentBase ? pullRequest === null && baseSha === headSha :
    Number.isSafeInteger(pullRequest) && pullRequest > 0),
    'CI_CONTEXT', 'Repositorio o PR inválido');
  commit(baseSha); commit(headSha);
  const before = readTree(root, baseSha), after = readTree(root, headSha);
  try { git(root, ['merge-base', '--is-ancestor', baseSha, headSha]); }
  catch { throw new ControlPolicyError('CI_ANCESTRY', 'La base debe ser ancestro del candidato'); }
  const cache = new Map();
  let total = 0;
  const blob = (entry, path) => {
    regular(entry, path);
    if (!cache.has(entry.oid)) {
      const size = Number(git(root, ['cat-file', '-s', entry.oid]).toString().trim());
      requireValue(Number.isSafeInteger(size) && size >= 0 && size <= MAX_BLOB && total + size <= MAX_TOTAL,
        'CI_BLOB_SIZE', `Objeto protegido excesivo: ${path}`);
      const bytes = git(root, ['cat-file', 'blob', entry.oid], { maxBuffer: MAX_BLOB + 1024 });
      requireValue(bytes.length === size, 'CI_GIT', 'Lectura incompleta de objeto');
      total += size; cache.set(entry.oid, bytes);
    }
    return cache.get(entry.oid);
  };
  const policyEntry = before.get(POLICY_PATH);
  requireValue(policyEntry, 'CI_POLICY_MISSING', 'La base no contiene política; requiere bootstrap explícito');
  requireValue(policyEntry.type === 'blob' && policyEntry.mode === '100644', 'CI_POLICY_SCHEMA', 'Política base no regular 100644');
  const policyBytes = blob(policyEntry, POLICY_PATH);
  let policy;
  try { policy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(policyBytes)); }
  catch { throw new ControlPolicyError('CI_POLICY_SCHEMA', 'Política base no es JSON UTF-8 válido'); }
  validatePolicy(policy);
  // Una actualización autorizada tampoco puede eliminar o inutilizar la política siguiente.
  const nextPolicyEntry = after.get(POLICY_PATH);
  requireValue(nextPolicyEntry && nextPolicyEntry.type === 'blob' && nextPolicyEntry.mode === '100644',
    'CI_POLICY_SCHEMA', 'El candidato debe conservar una política regular 100644');
  let nextPolicy;
  try { nextPolicy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(blob(nextPolicyEntry, POLICY_PATH))); }
  catch (error) {
    if (error instanceof ControlPolicyError) throw error;
    throw new ControlPolicyError('CI_POLICY_SCHEMA', 'Política candidata no es JSON UTF-8 válido');
  }
  // Solo validación estructural como datos: la cobertura utilizada sigue siendo la de la base.
  validatePolicy(nextPolicy);
  const changes = [], legalChanges = [];
  const describe = (entry, path) => entry ? { type: entry.type, mode: entry.mode, oid: entry.oid,
    bytes: blob(entry, path).length, sha256: sha256(blob(entry, path)) } : null;
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const path of paths) {
    const legal = coverage(path, policy.nonAuthorizableDirectories, policy.nonAuthorizableFiles);
    const critical = coverage(path, policy.criticalDirectories, policy.criticalFiles, policy.criticalFilePrefixes);
    if (!legal && !critical) continue;
    const old = before.get(path), next = after.get(path);
    const oldBytes = old ? blob(old, path) : null, newBytes = next ? blob(next, path) : null;
    if (old && next && old.type === next.type && old.mode === next.mode && oldBytes.equals(newBytes)) continue;
    const change = { path, before: describe(old, path), after: describe(next, path) };
    (legal ? legalChanges : changes).push(change);
  }
  const policySha256 = sha256(policyBytes);
  // Orden de claves fijo; rutas ordenadas por unidades UTF-16 (sin locale), UTF-8 + un LF.
  const changesDigest = sha256(Buffer.from(JSON.stringify({ schemaVersion: 1, repository, pullRequest,
    baseSha, headSha, policySha256, changes }) + '\n', 'utf8'));
  return { schemaVersion: 1, repository, pullRequest, baseSha, headSha, policySha256, changesDigest,
    changes, legalChanges, mergeApproval: false };
}
export function inspectControls(context) { return inspectContext(context); }

/** Diagnóstico manual de main: no admite candidato diferente, PR ficticio ni autorización. */
export function verifyCurrentControls({ root, repository, baseSha, headSha }) {
  const inspected = inspectContext({ root, repository, baseSha, headSha, pullRequest: null }, true);
  requireValue(!inspected.changes.length && !inspected.legalChanges.length,
    'CI_CONTEXT', 'El diagnóstico manual solo evalúa la base contra sí misma');
  return { ...inspected, controlIntegrity: 'unchanged', authorization: null,
    legalInputsUnchanged: true, legalVerificationRequired: true, mergeApproval: false };
}
function timestamp(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
    'CI_AUTH_TIME', 'Fecha debe ser UTC ISO con milisegundos');
  return Date.parse(value);
}
function authorize(value, inspection, now) {
  requireValue(value !== undefined && value !== null && value !== '', 'CI_AUTH_REQUIRED', 'Cambio crítico sin autorización externa');
  let auth;
  try { auth = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw new ControlPolicyError('CI_AUTH_SCHEMA', 'Autorización no es JSON válido'); }
  exactKeys(auth, AUTH_KEYS, 'CI_AUTH_SCHEMA');
  requireValue(auth.schemaVersion === 1 && typeof auth.authorizationId === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(auth.authorizationId) &&
    typeof auth.changesDigest === 'string' && /^[a-f0-9]{64}$/.test(auth.changesDigest),
    'CI_AUTH_SCHEMA', 'Formato de autorización inválido');
  requireValue(auth.repository === inspection.repository && auth.pullRequest === inspection.pullRequest &&
    auth.baseSha === inspection.baseSha && auth.headSha === inspection.headSha,
    'CI_AUTH_BINDING', 'Autorización para otro repositorio, PR, base o candidato');
  requireValue(auth.changesDigest === inspection.changesDigest, 'CI_AUTH_DIGEST', 'Digest de cambios no coincide');
  const issued = timestamp(auth.issuedAt), expires = timestamp(auth.expiresAt);
  requireValue(expires > issued && expires - issued <= MAX_AUTHORIZATION_MS,
    'CI_AUTH_TIME', 'Ventana debe ser positiva y no superar 24 horas');
  requireValue(issued <= now, 'CI_AUTH_NOT_YET_VALID', 'Autorización emitida en el futuro');
  requireValue(now < expires, 'CI_AUTH_EXPIRED', 'Autorización caducada');
  return { authorizationId: auth.authorizationId, issuedAt: auth.issuedAt, expiresAt: auth.expiresAt };
}

/** authorization y now son inputs del llamador confiable, nunca del PR ni del candidato. */
export function verifyControls({ authorization, now = Date.now(), ...context }) {
  requireValue(Number.isSafeInteger(now) && now >= 0, 'CI_AUTH_TIME', 'Reloj confiable inválido');
  const inspected = inspectControls(context);
  requireValue(inspected.legalChanges.length === 0, 'CI_LEGAL_IMMUTABLE', 'Inputs jurídicos no admiten excepción de CI');
  const authorized = inspected.changes.length ? authorize(authorization, inspected, now) : null;
  return { ...inspected, controlIntegrity: authorized ? 'authorized' : 'unchanged', authorization: authorized,
    legalInputsUnchanged: true, legalVerificationRequired: true, mergeApproval: false };
}
