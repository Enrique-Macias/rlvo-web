// Preload for the OWNER-EXECUTED secret operation. Deny implicit Worker creation.
const fs=require('node:fs'),crypto=require('node:crypto');
const ACCOUNT_SHA256='36da4df1ff8cc46833e102c0f192ea896c2259575bbe60ff013404d30bdca4fc';
function allowedSecretRequest(config, origin, method, path, accountFingerprint=ACCOUNT_SHA256){
 if(config.name!=='rlvo-share-links-staging'||crypto.createHash('sha256').update(config.account_id??'').digest('hex')!==accountFingerprint)return false;
 return origin==='https://api.cloudflare.com'&&(method==='GET'&&path.startsWith('/client/v4/')||method==='PUT'&&path===`/client/v4/accounts/${config.account_id}/workers/scripts/rlvo-share-links-staging/secrets`)
  ||origin==='https://dash.cloudflare.com'&&(method==='GET'&&path==='/'||method==='POST'&&path==='/oauth2/token');
}
module.exports={allowedSecretRequest};
if(process.env.RLVO_OG_SECRET_GUARD_CONFIG){
 const config=JSON.parse(fs.readFileSync(process.env.RLVO_OG_SECRET_GUARD_CONFIG,'utf8'));
 const undici=require('undici'),previous=undici.getGlobalDispatcher();
 let writes=0;
 undici.setGlobalDispatcher({dispatch(o,h){const method=String(o.method??'GET');if(!allowedSecretRequest(config,String(o.origin),method,String(o.path))||(method==='PUT'&&++writes>1))throw Error('OG_SECRET_TRANSPORT_DENIED');return previous.dispatch(o,h);},close:()=>Promise.resolve(),destroy:()=>Promise.resolve()});
}
