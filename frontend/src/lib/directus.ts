import { createDirectus, rest } from '@directus/sdk';
import { env } from '@/env';

type Schema = Record<string, never>;

export const directus = createDirectus<Schema>(env.NEXT_PUBLIC_DIRECTUS_URL).with(rest());
