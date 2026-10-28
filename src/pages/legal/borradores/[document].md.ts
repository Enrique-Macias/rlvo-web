import type { APIRoute } from 'astro';
import { DOCUMENTS, type DocumentKind } from '../../../legal/canonical';
import { getDraftEntry } from '../../../legal/registry';

export const getStaticPaths = () => DOCUMENTS.map((document) => ({ params: { document }, props: { document } }));
export const GET: APIRoute = ({ props }) => new Response(new Uint8Array(getDraftEntry(props.document as DocumentKind).bytes), {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex, follow', 'Cache-Control': 'no-store' },
});
