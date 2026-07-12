import { env } from '@/env';

export function toAssetUrl(fileId: string | null): string | null {
  if (!fileId) return null;
  return `${env.NEXT_PUBLIC_DIRECTUS_URL}/assets/${fileId}`;
}
