import { isSharePath, shareRoute, type Env, type ConfigState } from './config.ts';
import { loadPreview } from './share-preview.ts';
import { emergency, render } from './render.ts';
import { readOgConfig, isOgAttempt } from './og-config.ts';
import { createOgHandler, ogResponse } from './og-handler.ts';
import { loadOgRev } from './og-source.ts';

export interface SharePolicy {
  readConfig(env: Env): ConfigState | Promise<ConfigState>;
  origin(env: Env): string | null;
  home?: string;
  /** Module-only opt-in. Never populated from headers, query strings or environment bindings. */
  ogLocalTesting?: true;
}
/** Policy is supplied by trusted module code, never by runtime bindings or visitors. */
export function createShareHandler(policy: SharePolicy) {
  const image = createOgHandler();
  return async (request: Request, env: Env): Promise<Response> => {
    const path = new URL(request.url).pathname;
    if (!isSharePath(path)) return env.ASSETS.fetch(request);
    const start = Date.now();
    let status = 503;
    try {
      let preview;
      let imagePath: string | undefined;
      const origin = policy.origin(env);
      if (request.method !== 'GET' && request.method !== 'HEAD') status = 405;
      else {
        const route = shareRoute(path);
        if (!route && policy.ogLocalTesting === true && env.SHARE_OG_ENABLED !== undefined && env.SHARE_OG_ENABLED !== 'false' && isOgAttempt(path)) {
          const config = await policy.readConfig(env);
          if (config.state === 'disabled') return ogResponse(status = 404);
          if (config.state !== 'active') return ogResponse(status = 503);
          const og = readOgConfig(env, config.config, request, policy.ogLocalTesting === true);
          if (og.state !== 'active') return ogResponse(status = 503);
          const response = await image(request, env, og.config); status = response.status; return response;
        }
        else if (!route) status = 404;
        else {
          const config = await policy.readConfig(env);
          if (config.state === 'disabled') status = 404;
          else if (config.state === 'invalid') status = 503;
          else {
            preview = await loadPreview(config.config, route.tipo, route.token);
            status = preview === null ? 503 : preview.disponible ? 200 : 404;
            if (route.tipo === 'p' && preview?.disponible) {
              const og = readOgConfig(env, config.config, request, policy.ogLocalTesting === true);
              if (og.state === 'invalid') { status = 503; return emergency(request.method === 'HEAD'); }
              if (og.state === 'active') {
                const result = await loadOgRev(og.config, route.token, fetch, Math.max(0, 6000 - (Date.now() - start)));
                if (result.kind === 'unavailable') { status = 404; preview = null; }
                else if (result.kind === 'revision') imagePath = `/p/${route.token}/og/${result.rev}`;
                else if (result.kind !== 'none') { status = 503; return emergency(request.method === 'HEAD'); }
              }
            }
          }
        }
      }
      return await render(env, status, origin, path, preview ?? undefined,
        request.method === 'HEAD', policy.home, imagePath);
    } catch { status = 503; return emergency(request.method === 'HEAD'); }
    finally {
      console.log(JSON.stringify({ result: status === 200 ? 'available' : status === 404 ? 'unavailable' :
        status === 405 ? 'method' : 'temporary', status, durationMs: Date.now() - start }));
    }
  };
}
