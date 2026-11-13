import { isSharePath, type Env } from './config.ts';
import { createShareHandler, type SharePolicy } from './handler.ts';
import { createStagingPolicy } from './staging-policy.ts';
import { generic, headers } from './render.ts';
import { site } from '../src/config/site.ts';

const publicAssets = new Set(['/robots.txt', site.brandAssets.logo, site.brandAssets.favicon, site.seo.image]);
const assetPath = (path: string) => publicAssets.has(path) || /^\/_astro\/[A-Za-z0-9_.-]+\.(?:css|woff2)$/.test(path);

/** Dedicated entry. All requests must pass here before Static Assets normalization. */
export function createStagingWorker(policy: SharePolicy = createStagingPolicy()) {
  const share = createShareHandler({ ...policy, home: site.url });
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const path = new URL(request.url).pathname;
      if (isSharePath(path)) return share(request, env);
      if (request.method !== 'GET' && request.method !== 'HEAD') return generic(405, false);
      if (!assetPath(path)) return generic(404, request.method === 'HEAD');
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 200) return generic(404, request.method === 'HEAD');
      const h = headers();
      const ext = path.split('.').at(-1);
      h.set('Content-Type', ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' :
        ext === 'woff2' ? 'font/woff2' : ext === 'css' ? 'text/css; charset=utf-8' : 'text/plain; charset=utf-8');
      return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers: h });
    },
  };
}
export default createStagingWorker();
