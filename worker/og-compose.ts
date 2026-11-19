import { badgeBase64 } from './og-badge.ts';
import { cleanJpeg } from './og-image.ts';
import { readBounded } from './og-source.ts';

export interface ImagesInput {
  transform(options: { width: number; height: number; fit: 'pad'; background: string; metadata: 'none' }): ImagesInput;
  draw(image: ReadableStream<Uint8Array>, options: { right: number; bottom: number; opacity: number; composite: 'over' }): ImagesInput;
  output(options: { format: 'image/jpeg'; quality: number; anim: false }): Promise<{ response(): Response }>;
}
export interface ImagesBinding { input(stream: ReadableStream<Uint8Array>): ImagesInput }
const stream = (bytes: Uint8Array) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });

/** Only the output of a successful decode/re-encode may leave this module; never passthrough. */
export async function composeOg(images: ImagesBinding, source: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  const badge = Uint8Array.from(atob(badgeBase64), c => c.charCodeAt(0));
  const output = await images.input(stream(source))
    .transform({ width: 1200, height: 630, fit: 'pad', background: '#F5FAF8', metadata: 'none' })
    .draw(stream(badge), { right: 32, bottom: 32, opacity: 1, composite: 'over' })
    .output({ format: 'image/jpeg', quality: 85, anim: false });
  const response = output.response();
  if (signal.aborted || response.status !== 200 || response.headers.get('content-type') !== 'image/jpeg') {
    void response.body?.cancel().catch(() => {}); throw new Error('composition_failed');
  }
  const bytes = await readBounded(response, 2_097_152, signal);
  const clean = cleanJpeg(bytes);
  if (!clean) throw new Error('composition_failed');
  return clean;
}
