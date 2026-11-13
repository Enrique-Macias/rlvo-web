import { localOrigin, isSharePath, readConfig, shareRoute, type Env } from './config.ts';
import { site } from '../src/config/site.ts';
import { loadPreview } from './share-preview.ts';
import { emergency, render } from './render.ts';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (!isSharePath(path)) return env.ASSETS.fetch(request);
    const start = Date.now();
    let status = 503;
    try {
      let preview;
      const origin = localOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN) ?? site.url;
      if (request.method !== 'GET' && request.method !== 'HEAD') status = 405;
      else {
        const route = shareRoute(path);
        const config = readConfig(env);
        if (!route || config.state === 'disabled') status = 404;
        else if (config.state === 'invalid') status = 503;
        else {
          preview = await loadPreview(config.config, route.tipo, route.token);
          status = preview === null ? 503 : preview.disponible ? 200 : 404;
        }
      }
      return await render(env, status, origin, path, preview ?? undefined, request.method === 'HEAD');
    } catch { status = 503; return emergency(request.method === 'HEAD'); }
    finally {
      console.log(JSON.stringify({ result: status === 200 ? 'available' : status === 404 ? 'unavailable' :
        status === 405 ? 'method' : 'temporary', status, durationMs: Date.now() - start }));
    }
  },
};
