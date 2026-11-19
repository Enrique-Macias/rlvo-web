import { MAX_IMAGE_BYTES, REV, type OgConfig } from './og-config.ts';
import { imageInfo } from './og-image.ts';

export type OgResult = { kind: 'none' } | { kind: 'unavailable' } | { kind: 'temporary' } |
  { kind: 'revision'; rev: string } | { kind: 'conflict' } | { kind: 'image'; bytes: Uint8Array; mime: string };
const exact = (o: Record<string, unknown>, names: string[]) =>
  Object.keys(o).length === names.length && names.every(k => Object.hasOwn(o, k));
const jsonType = (s: string) => /^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(s);

/** Shared effective read cap; cancels the actual stream, not only its declared length. */
export async function readBounded(response: Response, max: number, signal: AbortSignal): Promise<Uint8Array> {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > max)) {
    void response.body?.cancel().catch(() => {}); throw new Error('invalid_body');
  }
  if (!response.body || signal.aborted) { void response.body?.cancel().catch(() => {}); throw new Error('invalid_body'); }
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const next = await reader.read();
      if (signal.aborted) throw new Error('deadline');
      if (next.done) break;
      total += next.value.byteLength;
      if (total > max) { abort(); throw new Error('invalid_body'); }
      chunks.push(next.value);
    }
    if (declared !== null && Number(declared) !== total) throw new Error('invalid_body');
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
}

async function source(config: OgConfig, token: string, rev: string | undefined,
  upstream: typeof fetch, timeoutMs: number): Promise<OgResult> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token) || token.length !== 22 ||
      (rev !== undefined && (!REV.test(rev) || rev.length !== 32)) || timeoutMs <= 0) return { kind: 'temporary' };
  const controller = new AbortController();
  let response: Response | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<OgResult>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve({ kind: 'temporary' }); }, timeoutMs);
  });
  const task = async (): Promise<OgResult> => {
    try {
      response = await upstream(config.endpoint, {
        method: 'POST', redirect: 'manual', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-RLVO-Og-Key': config.key },
        body: JSON.stringify(rev === undefined ? { v: 1, op: 'rev', token } : { v: 1, op: 'bytes', token, rev }),
      });
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); return { kind: 'temporary' }; }
      const mime = response.headers.get('content-type') ?? '';
      if (rev !== undefined && response.status === 200 && ['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        if (response.headers.get('x-rlvo-og-rev') !== rev || !response.headers.has('content-length')) {
          void response.body?.cancel().catch(() => {}); return { kind: 'temporary' };
        }
        const bytes = await readBounded(response, MAX_IMAGE_BYTES, controller.signal);
        const info = imageInfo(bytes, mime);
        if (!info || info.width > 4096 || info.height > 4096) return { kind: 'temporary' };
        return { kind: 'image', bytes, mime };
      }
      if (!jsonType(mime)) { void response.body?.cancel().catch(() => {}); return { kind: 'temporary' }; }
      const bytes = await readBounded(response, 512, controller.signal);
      const o: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!o || typeof o !== 'object' || Array.isArray(o)) return { kind: 'temporary' };
      const value = o as Record<string, unknown>;
      if (response.status === 404 && exact(value, ['v', 'disponible']) && value.v === 1 && value.disponible === false)
        return { kind: 'unavailable' };
      if (response.status === 409 && rev !== undefined && exact(value, ['error']) && value.error === 'rev_distinta')
        return { kind: 'conflict' };
      if (response.status === 200 && value.v === 1 && value.disponible === true) {
        if (exact(value, ['v', 'disponible', 'imagen']) && value.imagen === false) return { kind: 'none' };
        if (rev === undefined && exact(value, ['v', 'disponible', 'imagen', 'rev']) && value.imagen === true &&
            typeof value.rev === 'string' && value.rev.length === 32 && REV.test(value.rev)) return { kind: 'revision', rev: value.rev };
      }
      return { kind: 'temporary' };
    } catch { controller.abort(); return { kind: 'temporary' }; }
  };
  try { return await Promise.race([task(), deadline]); }
  finally { clearTimeout(timer); }
}
export const loadOgRev = (config: OgConfig, token: string, upstream: typeof fetch = fetch, timeoutMs = 6000) =>
  source(config, token, undefined, upstream, timeoutMs);
export const loadOgBytes = (config: OgConfig, token: string, rev: string, upstream: typeof fetch = fetch, timeoutMs = 13000) =>
  source(config, token, rev, upstream, timeoutMs);
