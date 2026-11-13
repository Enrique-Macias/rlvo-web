import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { auditStagingAssets } from './prepare-staging-assets.mjs';

export const CONFIG_PATH = 'wrangler.share-links.staging.jsonc';
export const EXPECTED = Object.freeze({
  name: 'rlvo-share-links-staging', main: 'worker/staging.ts', compatibility_date: '2026-09-29',
  workers_dev: false, preview_urls: false, observability: {enabled:false},
  assets: {directory:'./.wrangler/share-links-staging-assets',binding:'ASSETS',
    not_found_handling:'none',html_handling:'drop-trailing-slash',run_worker_first:true},
  vars: {SHARE_LINKS_ENABLED:'false',SHARE_LINKS_ENV:'staging',
    SHARE_LINKS_PUBLIC_ORIGIN:'https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev',SHARE_PREVIEW_URL:''},
});
export function validateStagingTarget(config, {configPath = CONFIG_PATH, args = [], targetEnv = process.env} = {}) {
  assert.equal(args.length, 0, 'No se admiten overrides de nombre, entorno o configuración');
  for (const key of ['CLOUDFLARE_ENV','WRANGLER_ENV','WRANGLER_CONFIG','WRANGLER_CONFIG_PATH','WRANGLER_NAME','CLOUDFLARE_WORKER_NAME']) assert(!Object.hasOwn(targetEnv,key), 'Override de destino en environment');
  assert.equal(resolve(configPath), resolve(CONFIG_PATH), 'Configuración distinta de STAGING');
  assert.deepEqual(config, EXPECTED, 'El destino debe ser el STAGING cerrado y apagado revisado');
  return true;
}
export function checkStagingTarget(args = process.argv.slice(2)) {
  assert(!lstatSync(CONFIG_PATH).isSymbolicLink(), 'Configuración enlazada');
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  validateStagingTarget(config, {args});
  const assets = auditStagingAssets();
  return {guard:'PASS',name:config.name,entry:config.main,assets:assets.length,enabled:false,ingress:false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(checkStagingTarget()));
}
