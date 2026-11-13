import { priceMxn } from './format.ts';
import { site } from '../src/config/site.ts';
import type { Env } from './config.ts';
import type { Preview } from './share-preview.ts';

export const robots = 'noindex, nofollow, noarchive';
export const csp = "default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
export const headers = () => new Headers({
  'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Robots-Tag': robots, 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': csp,
});


export async function render(env: Env, status: number, origin: string | null, path: string,
  preview?: Preview, head = false, home?: string): Promise<Response> {
  if (!origin) return generic(status === 200 ? 503 : status, head);
  let title = status === 503 ? 'Intenta de nuevo más tarde' :
    status === 405 ? 'Método no permitido' : 'Este enlace no está disponible';
  let description = status === 503 ? 'No pudimos consultar este enlace. Intenta de nuevo más tarde.' :
    'Puedes conocer más de RLVO en nuestro sitio.';
  let price = '';
  if (preview?.disponible) {
    title = preview.tipo === 'publicacion' ? preview.titulo : preview.nombre_publico;
    price = preview.tipo === 'publicacion' ? priceMxn(preview.precio_mxn) : '';
    description = preview.tipo === 'publicacion'
      ? price + ' · Una publicación compartida en ' + site.brand + '.'
      : 'Un perfil compartido en ' + site.brand + '.';
  }
  // Errors always share one stable URL and contain no requested token.
  const url = new URL(status === 200 ? path : '/compartir/plantilla', origin).href;
  const h = headers();
  if (status === 405) h.set('Allow', 'GET, HEAD');
  const template = await env.ASSETS.fetch(new Request(new URL('/compartir/plantilla', origin)));
  if (template.status !== 200) throw new Error('template_unavailable');
  const html = await template.text();
  if (/<script\b/i.test(html)) throw new Error('template_script');
  // Astro may inline trusted static CSS; hash only those literal blocks, never user input.
  const hashes = await Promise.all([...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(async m => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m[1]!)));
    return "'sha256-" + btoa(String.fromCharCode(...digest)) + "'";
  }));
  if (hashes.length) h.set('Content-Security-Policy', csp.replace("style-src 'self'", "style-src 'self' " + hashes.join(' ')));
  if (head) return new Response(null, { status, headers: h });
  const rewriter = new HTMLRewriter();
  const attribute = (selector: string, name: string, value: string) =>
    rewriter.on(selector, { element: e => { e.setAttribute(name, value); } });
  const content = (selector: string, value: string) =>
    rewriter.on(selector, { element: e => { e.setInnerContent(value, { html: false }); } });
  content('title', title + ' | ' + site.brand);
  content('h1', title);
  content('#share-description', preview?.disponible && preview.tipo === 'publicacion'
    ? 'Una publicación compartida en ' + site.brand + '.' : description);
  content('#share-price', price);
  attribute('meta[name="description"]', 'content', description);
  attribute('meta[property="og:title"]', 'content', title);
  attribute('meta[property="og:description"]', 'content', description);
  attribute('meta[property="og:url"]', 'content', url);
  attribute('meta[property="og:image"]', 'content', new URL(site.seo.image, origin).href);
  attribute('meta[name="twitter:title"]', 'content', title);
  attribute('meta[name="twitter:description"]', 'content', description);
  attribute('meta[name="twitter:image"]', 'content', new URL(site.seo.image, origin).href);
  attribute('link[rel="canonical"]', 'href', url);
  attribute('#rlvo-home', 'href', home ?? new URL('/', origin).href);
  return rewriter.transform(new Response(html, { status, headers: h }));
}
export function generic(status: number, head = false): Response {
  const title = status === 503 ? 'Intenta de nuevo más tarde' : status === 405 ? 'Método no permitido' : 'Este enlace no está disponible';
  const h = headers();
  if (status === 405) h.set('Allow', 'GET, HEAD');
  return new Response(head ? null : '<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="robots" content="noindex, nofollow, noarchive"><title>' + title + ' | RLVO</title><h1>' + title + '</h1></html>', {status, headers:h});
}
export function emergency(head: boolean): Response { return generic(503, head); }
