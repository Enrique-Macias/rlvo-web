import { PREVIEW_PATH, validPreviewKey, type Env, type ConfigState } from './config.ts';
import type { SharePolicy } from './handler.ts';

export const STAGING_ORIGIN = 'https://rlvo-share-links-staging.enriquemaciaslpz.workers.dev';
export const STAGING_ENDPOINT_SHA256 = '0a62d2a6775b0fb0b902127154b55adeae913273597a6af5047aa13c4dfdb1ab';
export const stagingOrigin = (value: string | undefined): string | null =>
  value === STAGING_ORIGIN ? STAGING_ORIGIN : null;

export async function endpointMatches(value: string | undefined, compiledPin: string): Promise<boolean> {
  try {
    if (!value || !/^[a-f0-9]{64}$/.test(compiledPin)) return false;
    const u = new URL(value);
    if (u.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(u.hostname) ||
        u.port || u.username || u.password || u.pathname !== PREVIEW_PATH ||
        u.search || u.hash || value.includes('?') || value.includes('#') || u.href !== value) return false;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const hex = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('');
    return hex === compiledPin;
  } catch { return false; }
}
/** Test injection is a module argument, not an environment variable or public input. */
export function createStagingPolicy(compiledPin = STAGING_ENDPOINT_SHA256): SharePolicy {
  return {
    origin: env => stagingOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN),
    async readConfig(env: Env): Promise<ConfigState> {
      if (env.SHARE_LINKS_ENABLED === undefined || env.SHARE_LINKS_ENABLED === 'false') return { state: 'disabled' };
      if (env.SHARE_LINKS_ENABLED !== 'true' || env.SHARE_LINKS_ENV !== 'staging') return { state: 'invalid' };
      const origin = stagingOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN);
      const key = env.SHARE_PREVIEW_KEY_CURRENT;
      if (!origin || !validPreviewKey(key) || !await endpointMatches(env.SHARE_PREVIEW_URL, compiledPin)) return { state: 'invalid' };
      return { state: 'active', config: { origin, endpoint: env.SHARE_PREVIEW_URL!, key } };
    },
  };
}
