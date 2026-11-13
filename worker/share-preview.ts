import { MAX_RESPONSE_BYTES, TIMEOUT_MS, type Config } from './config.ts';
export type Preview =
  | { v: 1; disponible: false }
  | { v: 1; tipo: 'publicacion'; disponible: true; titulo: string; precio_mxn: number }
  | { v: 1; tipo: 'perfil'; disponible: true; nombre_publico: string };

const exact = (o: Record<string, unknown>, keys: string[]) =>
  JSON.stringify(Object.keys(o).sort()) === JSON.stringify(keys.sort());
const text = (s: unknown, max: number): s is string =>
  typeof s === 'string' && Array.from(s).length >= 1 && Array.from(s).length <= max &&
  !/[\u0000]/u.test(s) && !/[\uD800-\uDFFF]/u.test(s);

export function validatePreview(value: unknown, tipo: 'p' | 'u'): Preview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (o.disponible === false && exact(o, ['v', 'disponible'])) return { v: 1, disponible: false };
  if (o.disponible !== true) return null;
  if (tipo === 'p' && o.tipo === 'publicacion' &&
      exact(o, ['v', 'tipo', 'disponible', 'titulo', 'precio_mxn']) &&
      text(o.titulo, 80) && Number.isInteger(o.precio_mxn) &&
      typeof o.precio_mxn === 'number' && o.precio_mxn >= 0 && o.precio_mxn <= 100000) {
    return { v: 1, disponible: true, tipo: 'publicacion', titulo: o.titulo, precio_mxn: o.precio_mxn };
  }
  if (tipo === 'u' && o.tipo === 'perfil' && exact(o, ['v', 'tipo', 'disponible', 'nombre_publico']) &&
      text(o.nombre_publico, 200)) return { v: 1, disponible: true, tipo: 'perfil', nombre_publico: o.nombre_publico };
  return null;
}

/** One deadline covers fetch AND the complete bounded body; abort and cancel on rejection. */
export async function loadPreview(config: Config, tipo: 'p' | 'u', token: string,
  upstream: typeof fetch = fetch, timeoutMs = TIMEOUT_MS): Promise<Preview | null> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); void reader?.cancel().catch(() => {}); resolve(null); }, timeoutMs);
  });
  const task = async (): Promise<Preview | null> => {
    try {
      const r = await upstream(config.endpoint, {
        method: 'POST', redirect: 'manual', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-RLVO-Preview-Key': config.key },
        body: JSON.stringify({ v: 1, tipo, token }),
      });
      const contentType = r.headers.get('content-type') ?? '';
      if (r.status !== 200 || !/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(contentType) ||
          (r.headers.has('content-length') && !/^\d+$/.test(r.headers.get('content-length')!)) ||
          Number(r.headers.get('content-length')) > MAX_RESPONSE_BYTES || !r.body) {
        controller.abort(); void r.body?.cancel().catch(() => {}); return null;
      }
      reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > MAX_RESPONSE_BYTES) { controller.abort(); void reader.cancel().catch(() => {}); return null; }
        chunks.push(next.value);
      }
      if (controller.signal.aborted) return null;
      const declared = r.headers.get('content-length');
      if (declared !== null && Number(declared) !== total) return null;
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return validatePreview(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), tipo);
    } catch { controller.abort(); void reader?.cancel().catch(() => {}); return null; }
  };
  try { return await Promise.race([task(), deadline]); }
  finally { clearTimeout(timer); }
}
