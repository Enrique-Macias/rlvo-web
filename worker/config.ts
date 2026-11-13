
export const PREVIEW_PATH = '/functions/v1/share-preview';
export const TOKEN = /^[A-Za-z0-9_-]{22}$/;
export const TIMEOUT_MS = 6_000;
export const MAX_RESPONSE_BYTES = 4_096;
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SHARE_LINKS_ENABLED?: string;
  SHARE_LINKS_ENV?: string;
  SHARE_LINKS_PUBLIC_ORIGIN?: string;
  SHARE_PREVIEW_URL?: string;
  SHARE_PREVIEW_KEY_CURRENT?: string;
}
export type Config = { origin: string; endpoint: string; key: string };
export function localOrigin(value: string | undefined): string | null {
  try {
    const u = new URL(value ?? '');
    if (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port ||
        u.username || u.password || u.pathname !== '/' || u.search || u.hash ||
        u.origin !== value) return null;
    return u.origin;
  } catch { return null; }
}
export function readConfig(env: Env): { state: 'disabled' } | { state: 'invalid' } | { state: 'active'; config: Config } {
  if (env.SHARE_LINKS_ENABLED === undefined || env.SHARE_LINKS_ENABLED === 'false') return { state: 'disabled' };
  if (env.SHARE_LINKS_ENABLED !== 'true' || env.SHARE_LINKS_ENV !== 'local') return { state: 'invalid' };
  const origin = localOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN);
  const key = env.SHARE_PREVIEW_KEY_CURRENT;
  try {
    const endpoint = new URL(env.SHARE_PREVIEW_URL ?? '');
    if (!origin || !key || !/^[\x21-\x7e]{32,256}$/.test(key) ||
        endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port ||
        endpoint.username || endpoint.password || endpoint.pathname !== PREVIEW_PATH ||
        endpoint.search || endpoint.hash || endpoint.href !== env.SHARE_PREVIEW_URL) return { state: 'invalid' };
    return { state: 'active', config: { origin, key, endpoint: endpoint.href } };
  } catch { return { state: 'invalid' }; }
}
// Remote activation intentionally has no approved upstream allowlist in W1 local.
export function shareRoute(path: string): { tipo: 'p' | 'u'; token: string } | null {
  const match = /^\/(p|u)\/([A-Za-z0-9_-]{22})$/.exec(path);
  return match ? { tipo: match[1] as 'p' | 'u', token: match[2]! } : null;
}
export const isSharePath = (path: string) => /^\/(p|u|%70|%75)(?:\/|$)/.test(path);
