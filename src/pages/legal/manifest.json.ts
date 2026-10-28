import { technicalManifest } from '../../legal/registry';

// Manifiesto estático: columnas del catálogo en hex + campos web de descarga. No consulta ni activa Supabase.
export const GET = () => new Response(JSON.stringify(technicalManifest(), null, 2) + '\n', {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex, follow', 'Cache-Control': 'no-store' },
});
