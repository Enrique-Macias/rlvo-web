import type { APIRoute } from 'astro';
import { DOCUMENTS, type DocumentKind } from '../../../legal/canonical';
import { getDraftEntry } from '../../../legal/registry';

export const getStaticPaths = () => DOCUMENTS.map((document) => ({ params: { document }, props: { document } }));
export const GET: APIRoute = ({ props }) => {
  const entry = getDraftEntry(props.document as DocumentKind);
  return new Response(`${entry.sha256}  ${entry.document}.md\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' } });
};
