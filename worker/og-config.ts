import { localOrigin, validPreviewKey, type Config, type Env } from './config.ts';

export const OG_PATH = '/functions/v1/share-og-source';
export const MAX_IMAGE_BYTES = 5_242_880;
export const OG_IMAGE_TIMEOUT_MS = 15_000;
export const REV = /^[0-9a-f]{32}$/;
export type OgConfig = { endpoint: string; key: string };
export type OgState = { state: 'disabled' } | { state: 'invalid' } | { state: 'active'; config: OgConfig };

/** A request URL is not proof of the client's network origin. Only trusted local entry code may opt in. */
export function readOgConfig(env: Env, preview: Config, request: Request, localTesting = false): OgState {
  if (!localTesting) return { state: 'disabled' };
  if (env.SHARE_OG_ENABLED === undefined || env.SHARE_OG_ENABLED === 'false') return { state: 'disabled' };
  if (env.SHARE_OG_ENABLED !== 'true' || env.SHARE_LINKS_ENV !== 'local' ||
      !localOrigin(preview.origin) || new URL(request.url).origin !== preview.origin ||
      !validPreviewKey(env.SHARE_OG_KEY_CURRENT) || /[\r\n]/.test(env.SHARE_OG_KEY_CURRENT) ||
      env.SHARE_OG_KEY_CURRENT === preview.key) return { state: 'invalid' };
  const expected = new URL(OG_PATH, preview.endpoint).href;
  if (env.SHARE_OG_SOURCE_URL !== expected || new URL(expected).hostname !== '127.0.0.1' ||
      new URL(expected).protocol !== 'http:') return { state: 'invalid' };
  return { state: 'active', config: { endpoint: expected, key: env.SHARE_OG_KEY_CURRENT } };
}

/** Validate the serialized path before decoding. WHATWG/edge normalization upstream is outside this parser. */
export function ogRoute(url: string): { token: string; rev: string } | null {
  const raw = /^https?:\/\/[^/]+(\/[^?#]*)$/.exec(url);
  if (!raw || /[%\\;]/.test(raw[1]!)) return null;
  const match = /^\/p\/([A-Za-z0-9_-]{22})\/og\/([0-9a-f]{32})$/.exec(raw[1]!);
  return match && match[0] === raw[1] ? { token: match[1]!, rev: match[2]! } : null;
}

export const isOgAttempt = (path: string) => /^\/(?:p|%70)(?:\/|$)/.test(path) && path.split('/').length > 3;
