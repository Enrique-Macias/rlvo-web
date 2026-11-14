import assert from 'node:assert/strict';
import { readFileSync, lstatSync, readdirSync, mkdirSync, writeFileSync, openSync, closeSync, fchmodSync, constants } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXPECTED as CLOSED } from './check-staging-target.mjs';
import { auditStagingAssets } from './prepare-staging-assets.mjs';
import { endpointMatches, STAGING_ENDPOINT_SHA256 } from '../../worker/staging-policy.ts';

export const TEMPLATE_PATH = 'wrangler.share-links.staging.private.template.jsonc';
export const CONFIG_PATH = '.wrangler/share-links-staging-private/wrangler.jsonc';
export const ACCOUNT_FINGERPRINT = '36da4df1ff8cc468';
export const ENDPOINT_PLACEHOLDER = '__PINNED_STAGING_ENDPOINT_FROM_STDIN__';
// W2-F1: exact approved generic package, not a manifest supplied by the operator.
const APPROVED_ASSETS = [
  {
    "path": "/_astro/fraunces-latin-wght-normal.ukD16Tqj.woff2",
    "bytes": 36620,
    "sha256": "7f9d191d999336d3b9790afa72e1358e50a13b06d4f289341e92a311967a80f9"
  },
  {
    "path": "/_astro/inter-latin-wght-normal.Dx4kXJAl.woff2",
    "bytes": 48256,
    "sha256": "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62"
  },
  {
    "path": "/404.html",
    "bytes": 204,
    "sha256": "193fdbdaf2d8c48cfcf76de6231e84044e0836d33f506e28d5c130beed273032"
  },
  {
    "path": "/brand/07_logo_horizontal_verde_transparente.svg",
    "bytes": 1350,
    "sha256": "395cf92dd570b307faf81f30eb158126d70976223f0572c2ab0e92750e187c89"
  },
  {
    "path": "/compartir/plantilla.html",
    "bytes": 5340,
    "sha256": "26c099f73f7bfd1e3bf31cac374bd161b494ff676ee2b9f94fdfca5a3df76cad"
  },
  {
    "path": "/favicon.svg",
    "bytes": 371,
    "sha256": "39d4796c608c6ce8db210b9b16814cdb94fde0a9b62a5ca272dbb8c5c74eb4ee"
  },
  {
    "path": "/og/rlvo-paleta-06.png",
    "bytes": 15781,
    "sha256": "43046d631a9a94648220ac8edceae8d4ef4f13baabc8cc9e3e8d838346f34093"
  },
  {
    "path": "/robots.txt",
    "bytes": 26,
    "sha256": "331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1"
  }
];
const template = () => {
  const c = structuredClone(CLOSED);
  c.workers_dev = true;
  c.vars.SHARE_LINKS_ENABLED = 'true';
  c.vars.SHARE_PREVIEW_URL = ENDPOINT_PLACEHOLDER;
  return c;
};
export function validatePrivateTemplate(value) {
  assert.deepEqual(value, template(), 'Plantilla privada distinta de la aprobada');
}
export function rejectPrivateOverrides(args, targetEnv) {
  assert.equal(args.length, 0, 'No se admiten argumentos ni overrides');
  for (const key of Object.keys(targetEnv)) {
    if (/^(?:CF_|CLOUDFLARE_|WRANGLER_|SHARE_LINKS_|SHARE_PREVIEW_)/.test(key)) {
      const harmless = key === 'WRANGLER_SEND_METRICS' && targetEnv[key] === 'false' ||
        key === 'WRANGLER_SEND_ERROR_REPORTS' && targetEnv[key] === 'false';
      assert(harmless, 'Environment puede cambiar destino, credenciales o garantías');
    }
  }
}
function present(path) {
  try { lstatSync(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function regular(root, path, directory = false) {
  let p = resolve(root);
  assert(!lstatSync(p).isSymbolicLink() && lstatSync(p).isDirectory(), 'Raíz enlazada o inválida');
  for (const part of path.split('/')) {
    assert(part && part !== '.' && part !== '..', 'Ruta interna inválida');
    p = join(p, part);
    assert(!lstatSync(p).isSymbolicLink(), 'Symlink no permitido');
  }
  assert(directory ? lstatSync(p).isDirectory() : lstatSync(p).isFile(), 'Entrada no regular');
  return p;
}
function jsonFile(root, path) {
  const text = readFileSync(regular(root, path), 'utf8');
  const value = JSON.parse(text);
  // Reject duplicate keys, alternate encodings and ambiguous JSON representations.
  assert.equal(text, JSON.stringify(value, null, 2) + '\n', 'JSON no canónico');
  return value;
}
function localPreflight(root, args, targetEnv) {
  rejectPrivateOverrides(args, targetEnv);
  for (const dir of [root, join(root, dirname(CONFIG_PATH))]) {
    if (!present(dir)) continue;
    if (dir !== root) regular(root, dirname(CONFIG_PATH), true);
    for (const name of readdirSync(dir)) {
      assert(!/^(?:\.env(?:$|\.)|\.dev\.vars(?:$|\.))/.test(name) || name === '.env.example', 'Archivo local de variables no permitido');
    }
  }
  assert(!present(join(root, '.wrangler/deploy/config.json')), 'Redirección de configuración Wrangler no permitida');
  validatePrivateTemplate(jsonFile(root, TEMPLATE_PATH));
  regular(root, CLOSED.main);
  regular(root, '.wrangler/share-links-staging-assets', true);
  assert.deepEqual(auditStagingAssets(resolve(root, CLOSED.assets.directory)), APPROVED_ASSETS, 'Assets distintos de W2-F1');
}
/** Pure test seam, like W2's endpoint policy factory. CLI always uses the compiled pin.
 * This module has no deploy command, hosted credentials, Access assertions or network IO.
 */
export function createPrivateControls(compiledPin = STAGING_ENDPOINT_SHA256) {
  async function validate(config, {configPath = CONFIG_PATH, args = [], targetEnv = process.env} = {}) {
    rejectPrivateOverrides(args, targetEnv);
    assert.equal(configPath, CONFIG_PATH, 'Archivo de configuración privada distinto');
    assert(await endpointMatches(config?.vars?.SHARE_PREVIEW_URL, compiledPin), 'Endpoint fuera del pin STAGING');
    const expected = template();
    expected.main = '../../worker/staging.ts';
    expected.assets.directory = '../share-links-staging-assets';
    expected.vars.SHARE_PREVIEW_URL = config.vars.SHARE_PREVIEW_URL;
    assert.deepEqual(config, expected, 'Destino privado distinto del aprobado');
    return true;
  }
  async function check(args = [], {root = process.cwd(), targetEnv = process.env} = {}) {
    localPreflight(root, args, targetEnv);
    const config = jsonFile(root, CONFIG_PATH);
    await validate(config, {args, targetEnv});
    // main and assets are relative to the generated Wrangler file, not the shell cwd.
    assert.equal(resolve(root, dirname(CONFIG_PATH), config.main), resolve(root, CLOSED.main));
    regular(root, CLOSED.main);
    return {guard:'PASS',scope:'LOCAL_ONLY',name:config.name,config:CONFIG_PATH,assets:8,
      enabled:true,workersDev:true,previews:false,expectedAccountFingerprint:ACCOUNT_FINGERPRINT,
      hostedPreflight:'REQUIRED_NOT_PERFORMED',deploymentAuthorized:false};
  }
  async function prepare(input, {root = process.cwd(), args = [], targetEnv = process.env} = {}) {
    assert(input && typeof input === 'object' && !Array.isArray(input) &&
      JSON.stringify(Object.keys(input)) === '["endpoint"]', 'Entrada debe contener solo endpoint');
    assert(await endpointMatches(input.endpoint, compiledPin), 'Endpoint fuera del pin STAGING');
    localPreflight(root, args, targetEnv);
    const config = template();
    config.main = '../../worker/staging.ts';
    config.assets.directory = '../share-links-staging-assets';
    config.vars.SHARE_PREVIEW_URL = input.endpoint;
    await validate(config, {args, targetEnv});
    const dir = join(root, dirname(CONFIG_PATH));
    if (present(dir)) regular(root, dirname(CONFIG_PATH), true);
    else mkdirSync(dir, {mode:0o700});
    const path = join(root, CONFIG_PATH);
    if (present(path)) { regular(root, CONFIG_PATH); assert.equal(lstatSync(path).nlink, 1, 'Config enlazada por hardlink'); }
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
    try { fchmodSync(fd, 0o600); writeFileSync(fd, JSON.stringify(config, null, 2) + '\n'); }
    finally { closeSync(fd); }
    return check([], {root, targetEnv});
  }
  return {validate, check, prepare};
}
const sealed = createPrivateControls();
export const validateStagingPrivateTarget = sealed.validate;
export const checkStagingPrivateTarget = sealed.check;
export const prepareStagingPrivateConfig = sealed.prepare;
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await checkStagingPrivateTarget(process.argv.slice(2)))); }
  catch { console.error('PRIVATE_TARGET_REJECTED: revise configuración, assets y overrides; no se autorizó deployment'); process.exitCode = 1; }
}
