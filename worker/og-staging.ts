import type { Env } from './config.ts';
import { createStagingWorker } from './staging.ts';
import { createStagingPolicy } from './staging-policy.ts';
import { isOgAttempt } from './og-config.ts';
import { ogResponse } from './og-handler.ts';
import { stagingFixtureGate, stagingOgConfig, stagingSessionProject } from './og-staging-policy.ts';
import manifest from './og-staging-fixtures.json';

/**
 * Test-only entry: Access protects ingress; this independent gate authorizes synthetic tokens.
 * The versioned manifest is empty, so this default export keeps OG closed. compiledPin is a
 * module argument for tests only; production code always uses the V1 STAGING endpoint pin.
 */
export function createOgStagingWorker(fixtures: unknown = manifest, now: () => number = Date.now, compiledPin?: string) {
  const permitted = stagingFixtureGate(fixtures, now);
  const projectRef = stagingSessionProject(fixtures);
  const worker = createStagingWorker({ ...createStagingPolicy(compiledPin),
    readOgConfig: (env, preview, request) => stagingOgConfig(env, preview, request, permitted, projectRef),
  });
  return {
    fetch(request: Request, env: Env): Promise<Response> {
      if (isOgAttempt(new URL(request.url).pathname) && !permitted(request))
        return Promise.resolve(ogResponse(404, undefined, undefined, request.method === 'HEAD'));
      return worker.fetch(request, env);
    },
  };
}
export default createOgStagingWorker();
