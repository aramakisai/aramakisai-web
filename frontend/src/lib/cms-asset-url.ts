import { env } from '@/env';

/** CMS が生成する派生サイズ。幅は cms/src/collections/media.ts の IMAGE_SIZES と一致させる。 */
const GENERATED_SIZES = [
  { name: 'card', width: 960 },
  { name: 'hero', width: 1920 },
] as const;

export type ImageSizeName = (typeof GENERATED_SIZES)[number]['name'] | 'original';

export function pickImageSize(width?: number): ImageSizeName {
  if (!width) return 'original';
  const fit = GENERATED_SIZES.find((size) => size.width >= width);
  return fit?.name ?? GENERATED_SIZES[GENERATED_SIZES.length - 1].name;
}

/**
 * 配信時変換を行わないため、URL はサイズ名までを指す。
 * 実ファイルへの解決は CMS 側の serve エンドポイントが担う。
 */
export function toAssetUrl(
  fileId: string | null,
  width?: number,
): string | null {
  if (!fileId) return null;
  return `${env.NEXT_PUBLIC_CMS_URL}/api/media/serve/${fileId}/${pickImageSize(width)}`;
}
