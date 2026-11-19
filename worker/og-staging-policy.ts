import { TOKEN, PREVIEW_PATH, shareRoute, validPreviewKey, type Env, type Config } from './config.ts';
import { OG_PATH, ogRoute, isOgAttempt, type OgState } from './og-config.ts';
import { STAGING_ORIGIN } from './staging-policy.ts';

const MAX_SESSION_MS = 2 * 60 * 60 * 1000;
/** Same project shape the V1 STAGING endpoint pin accepts. No real project ref is versioned. */
const PROJECT_REF = /^[a-z0-9]{20}$/;
const MANIFEST_KEYS = 'expiresAt,projectRef,startsAt,tokens,v';

/**
 * Endpoints are derived from a validated project ref with fixed host suffix and paths.
 * The ref comes only from the compiled private session manifest, never from requests.
 */
export function ogStagingEndpoints(projectRef: unknown): { preview: string; source: string } | null {
  if (typeof projectRef !== 'string' || !PROJECT_REF.test(projectRef)) return null;
  const origin = `https://${projectRef}.supabase.co`;
  return { preview: origin + PREVIEW_PATH, source: origin + OG_PATH };
}

type Session = { tokens: Set<string>; start: number; end: number; projectRef: string };
function parseSession(manifest: unknown): Session | null {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
  const m = manifest as Record<string, unknown>;
  if (Object.keys(m).sort().join(',') !== MANIFEST_KEYS || m.v !== 1 || !ogStagingEndpoints(m.projectRef) ||
    !Array.isArray(m.tokens) || m.tokens.length < 1 || m.tokens.length > 4 ||
    !m.tokens.every(t => typeof t === 'string' && t.length === 22 && TOKEN.test(t)) ||
    new Set(m.tokens).size !== m.tokens.length || typeof m.startsAt !== 'string' || typeof m.expiresAt !== 'string') return null;
  const start = Date.parse(m.startsAt), end = Date.parse(m.expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_SESSION_MS) return null;
  return { tokens: new Set(m.tokens as string[]), start, end, projectRef: m.projectRef as string };
}

/** Project ref of a valid session manifest, or null (fail closed). */
export const stagingSessionProject = (manifest: unknown): string | null => parseSession(manifest)?.projectRef ?? null;

/** The manifest is compiled into this test entry. Environment/header/query values cannot supply it. */
export function stagingFixtureGate(manifest: unknown, now: () => number = Date.now) {
  const session = parseSession(manifest);
  return (request: Request): boolean => {
    try {
      if (!session || new URL(request.url).origin !== STAGING_ORIGIN) return false;
      const route = isOgAttempt(new URL(request.url).pathname) ? ogRoute(request.url) : shareRoute(new URL(request.url).pathname);
      const time = now();
      return Number.isFinite(time) && time >= session.start && time < session.end && !!route &&
        (!('tipo' in route) || route.tipo === 'p') && session.tokens.has(route.token);
    } catch { return false; }
  };
}

/**
 * The preview endpoint was already pinned by the V1 STAGING policy; requiring it to match the
 * manifest project binds OG to that same pinned project. The OG endpoint used is the derived one.
 */
export function stagingOgConfig(env: Env, preview: Config, request: Request, permitted: (r: Request) => boolean,
  projectRef: string | null): OgState {
  if (!permitted(request) || env.SHARE_OG_ENABLED === undefined || env.SHARE_OG_ENABLED === 'false') return { state: 'disabled' };
  const ep = ogStagingEndpoints(projectRef);
  if (!ep || env.SHARE_OG_ENABLED !== 'true' || env.SHARE_LINKS_ENV !== 'staging' ||
    preview.origin !== STAGING_ORIGIN || preview.endpoint !== ep.preview ||
    env.SHARE_OG_SOURCE_URL !== ep.source || !validPreviewKey(env.SHARE_OG_KEY_CURRENT) ||
    env.SHARE_OG_KEY_CURRENT === preview.key) return { state: 'invalid' };
  return { state: 'active', config: { endpoint: ep.source, key: env.SHARE_OG_KEY_CURRENT } };
}
