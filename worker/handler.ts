import { isSharePath, shareRoute, type Env, type ConfigState } from './config.ts';
import { loadPreview } from './share-preview.ts';
import { emergency, render } from './render.ts';

export interface SharePolicy {
  readConfig(env: Env): ConfigState | Promise<ConfigState>;
  origin(env: Env): string | null;
  home?: string;
}
/** Policy is supplied by trusted module code, never by runtime bindings or visitors. */
export function createShareHandler(policy: SharePolicy) {
  return async (request: Request, env: Env): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (!isSharePath(path)) return env.ASSETS.fetch(request);
    const start = Date.now();
    let status = 503;
    try {
      let preview;
      const origin = policy.origin(env);
      if (request.method !== 'GET' && request.method !== 'HEAD') status = 405;
      else {
        const route = shareRoute(path);
        if (!route) status = 404;
        else {
          const config = await policy.readConfig(env);
          if (config.state === 'disabled') status = 404;
          else if (config.state === 'invalid') status = 503;
          else {
            preview = await loadPreview(config.config, route.tipo, route.token);
            status = preview === null ? 503 : preview.disponible ? 200 : 404;
          }
        }
      }
      return await render(env, status, origin, path, preview ?? undefined,
        request.method === 'HEAD', policy.home);
    } catch { status = 503; return emergency(request.method === 'HEAD'); }
    finally {
      console.log(JSON.stringify({ result: status === 200 ? 'available' : status === 404 ? 'unavailable' :
        status === 405 ? 'method' : 'temporary', status, durationMs: Date.now() - start }));
    }
  };
}
