import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  client: {
    NEXT_PUBLIC_DIRECTUS_URL: z.string().url(),
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE: z.enum(['true']).optional(),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_DIRECTUS_URL: process.env.NEXT_PUBLIC_DIRECTUS_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE:
      process.env.NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE || undefined,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined,
  },
});
