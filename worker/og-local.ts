import { localOrigin, readConfig } from './config.ts';
import { site } from '../src/config/site.ts';
import { createShareHandler } from './handler.ts';

// Explicit local test entry. Normal W1 and STAGING entry points NEVER opt in.
// Serve with Wrangler --local --ip 127.0.0.1; this module is not a deployment target.
export default {
  fetch: createShareHandler({
    readConfig,
    origin: env => localOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN) ?? site.url,
    ogLocalTesting: true,
  }),
};
