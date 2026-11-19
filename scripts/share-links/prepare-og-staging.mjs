// LOCAL generator only. Never reads secrets, authenticates, fetches or deploys.
// The private handoff (outside Git, 0600) is the only source of the STAGING project ref.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {stagingFixtureGate,ogStagingEndpoints} from '../../worker/og-staging-policy.ts';
import {STAGING_ORIGIN,STAGING_ENDPOINT_SHA256} from '../../worker/staging-policy.ts';
const USAGE='Usage: node --experimental-strip-types scripts/share-links/prepare-og-staging.mjs <private-synthetic-handoff.json> <verified-account-id> <existing-workers-dev:true|false>';
const validArgs=(accountId,ingress)=>/^[a-f0-9]{32}$/.test(accountId??'')&&['true','false'].includes(ingress);

/** endpointPin is a module argument for tests only; the CLI always uses the compiled V1 STAGING pin. */
export function prepareOgStagingSession(handoff,accountId,ingress,{cwd=process.cwd(),endpointPin=STAGING_ENDPOINT_SHA256}={}){
 assert(validArgs(accountId,ingress),USAGE);
 assert(handoff?.syntheticOnly===true && handoff.fixtureVerified===true,'Backend operator must attest isolated synthetic ownership/evidence');
 const manifest=handoff.manifest,ep=ogStagingEndpoints(manifest?.projectRef);
 assert(ep && /^[a-f0-9]{64}$/.test(endpointPin) && createHash('sha256').update(ep.preview).digest('hex')===endpointPin,'Manifest project is not the pinned STAGING project');
 assert(stagingFixtureGate(manifest)(new Request(STAGING_ORIGIN+'/p/'+manifest.tokens?.[0])),'Invalid, expired or not-yet-active manifest');
 const out=resolve(cwd,'.wrangler/og-staging-session');assert(!existsSync(out),'Preserve previous session directory; use a reviewed new worktree for another session');
 const config=JSON.parse(readFileSync(resolve(cwd,'wrangler.share-links.og.staging.jsonc'),'utf8').replace(/^\s*\/\/.*$/gm,''));
 assert(config.vars.SHARE_PREVIEW_URL===''&&config.vars.SHARE_OG_SOURCE_URL==='','Versioned STAGING config must not carry backend endpoints');
 mkdirSync(out,{recursive:true,mode:0o700});
 config.account_id=accountId;config.workers_dev=ingress==='true';config.main='./entry.ts';config.assets.directory=resolve(cwd,'.wrangler/share-links-staging-assets');
 config.vars.SHARE_PREVIEW_URL=ep.preview;config.vars.SHARE_OG_SOURCE_URL=ep.source;
 config.vars.SHARE_LINKS_ENABLED='true';config.vars.SHARE_OG_ENABLED='true';
 const entry=`import {createOgStagingWorker} from ${JSON.stringify(resolve(cwd,'worker/og-staging.ts'))};\nexport default createOgStagingWorker(${JSON.stringify(manifest)});\n`;
 writeFileSync(resolve(out,'entry.ts'),entry,{mode:0o600});writeFileSync(resolve(out,'active.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
 config.vars.SHARE_OG_ENABLED='false';writeFileSync(resolve(out,'off.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600});
 writeFileSync(resolve(out,'handoff-review.json'),JSON.stringify({syntheticOnly:true,fixtureVerified:true,manifest,preparedAt:new Date().toISOString(),remoteAuthorized:false},null,2)+'\n',{mode:0o600});
 return out;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [manifestFile,accountId,ingress]=process.argv.slice(2);
 assert(manifestFile && validArgs(accountId,ingress),USAGE);
 prepareOgStagingSession(JSON.parse(readFileSync(manifestFile,'utf8')),accountId,ingress);
 console.log('LOCAL_ONLY: active.json and off.json prepared in .wrangler/og-staging-session. Remote inventory, Access and authorization remain mandatory.');
}
