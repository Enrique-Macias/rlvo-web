import type { APIRoute } from 'astro';
import type { DocumentKind } from '../../../legal/canonical';
import { getLegalEntry, getReleaseReferences } from '../../../legal/registry';

export const getStaticPaths = () => getReleaseReferences().map(({ document, version }) => ({ params: { document, version }, props: { document, version } }));
export const GET: APIRoute = ({ props }) => new Response(new Uint8Array(getLegalEntry(props.document as DocumentKind, props.version as string).bytes), {
  headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' },
});
