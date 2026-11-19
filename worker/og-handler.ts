import type { Env } from './config.ts';
import type { OgConfig } from './og-config.ts';
import { OG_IMAGE_TIMEOUT_MS, ogRoute } from './og-config.ts';
import { loadOgBytes } from './og-source.ts';
import { composeOg } from './og-compose.ts';
import { headers } from './render.ts';
import { site } from '../src/config/site.ts';

export function ogResponse(status: number, bytes?: Uint8Array, mime?: string, head = false): Response {
  const h = headers();
  h.delete('Content-Type');
  if (status === 405) h.set('Allow', 'GET, HEAD');
  if (status === 503) h.set('Retry-After', '5');
  if (mime) h.set('Content-Type', mime);
  h.set('Content-Length', String(bytes?.byteLength ?? 0));
  return new Response(head || !bytes ? null : bytes as BodyInit, { status, headers: h });
}

/** One in-flight image per handler/isolate; no cache or cross-request source reuse. */
export function createOgHandler() {
  let busy = false;
  return async (request: Request, env: Env, config: OgConfig): Promise<Response> => {
    const head = request.method === 'HEAD';
    if (!['GET', 'HEAD'].includes(request.method)) return ogResponse(405);
    const route = ogRoute(request.url);
    if (!route) return ogResponse(404, undefined, undefined, head);
    if (busy) return ogResponse(503, undefined, undefined, head);
    busy = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Response>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(ogResponse(503, undefined, undefined, head)); }, OG_IMAGE_TIMEOUT_MS);
    });
    const task = async (): Promise<Response> => {
      try {
        const result = await loadOgBytes(config, route.token, route.rev);
        if (controller.signal.aborted) return ogResponse(503, undefined, undefined, head);
        if (result.kind === 'unavailable') return ogResponse(404, undefined, undefined, head);
        if (result.kind === 'conflict') return ogResponse(409, undefined, undefined, head);
        if (result.kind === 'none') {
          const asset = await env.ASSETS.fetch(new Request(new URL(site.seo.image, request.url)));
          if (asset.status !== 200 || asset.headers.get('content-type') !== 'image/png') return ogResponse(503, undefined, undefined, head);
          const { readBounded } = await import('./og-source.ts');
          const bytes = await readBounded(asset, 131072, controller.signal);
          return ogResponse(200, bytes, 'image/png', head);
        }
        if (result.kind !== 'image' || !env.IMAGES) return ogResponse(503, undefined, undefined, head);
        const bytes = await composeOg(env.IMAGES, result.bytes, controller.signal);
        if (controller.signal.aborted) return ogResponse(503, undefined, undefined, head);
        return ogResponse(200, bytes, 'image/jpeg', head);
      } catch { return ogResponse(503, undefined, undefined, head); }
    };
    // A timed-out Images operation cannot be aborted by its API. Keep the slot occupied
    // until it settles; late output is discarded and cannot release someone else's slot.
    const work = task().finally(() => { busy = false; });
    try { return await Promise.race([work, deadline]); }
    finally { clearTimeout(timer); }
  };
}
