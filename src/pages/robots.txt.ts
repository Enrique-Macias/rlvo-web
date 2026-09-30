import { canonical } from '../config/site';
export const GET = () => new Response(
  import.meta.env.SITE_ENV === 'preview'
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${canonical('/sitemap-index.xml')}\n`,
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
