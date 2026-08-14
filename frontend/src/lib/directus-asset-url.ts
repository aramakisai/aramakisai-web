import { env } from '@/env';

export function toAssetUrl(
  fileId: string | null,
  width?: number,
): string | null {
  if (!fileId) return null;
  const widthParam = width ? `&width=${width}` : '';
  return `${env.NEXT_PUBLIC_DIRECTUS_URL}/assets/${fileId}?format=webp${widthParam}`;
}
