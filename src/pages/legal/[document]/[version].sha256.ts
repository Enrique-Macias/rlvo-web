import type { APIRoute } from 'astro';
import type { DocumentKind } from '../../../legal/canonical';
import { getLegalEntry, getReleaseReferences } from '../../../legal/registry';

export const getStaticPaths = () => getReleaseReferences().map(({ document, version }) => ({ params: { document, version }, props: { document, version } }));
export const GET: APIRoute = ({ props }) => {
  const entry = getLegalEntry(props.document as DocumentKind, props.version as string);
  return new Response(`${entry.sha256}  ${entry.version}.md\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' } });
};
