import { localOrigin, readConfig } from './config.ts';
import { site } from '../src/config/site.ts';
import { createShareHandler } from './handler.ts';

// W1 entry stays local-only, regardless of SHARE_LINKS_ENV supplied at runtime.
export default {
  fetch: createShareHandler({
    readConfig,
    origin: env => localOrigin(env.SHARE_LINKS_PUBLIC_ORIGIN) ?? site.url,
  }),
};
