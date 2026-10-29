import { env } from '@/env';
import type { Attachment } from './home-page-types';

/** CMS が生成する派生サイズ。幅は cms/src/collections/media.ts の IMAGE_SIZES と一致させる。 */
const GENERATED_SIZES = [
  { name: 'card', width: 960 },
  { name: 'hero', width: 1920 },
] as const;

export type ImageSizeName =
  (typeof GENERATED_SIZES)[number]['name'] | 'original';

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

const toAbsolute = (url: string) =>
  url.startsWith('/') ? `${env.NEXT_PUBLIC_CMS_URL}${url}` : url;

/**
 * REST が返す実ファイル URL を直接使い、serve エンドポイントの 302 を避ける。
 * depth が効かず ID しか無い場合は serve URL にフォールバックする。
 */
export function toHeroImage(image: Attachment): {
  src: string;
  srcSet?: string;
} | null {
  const src = image.heroUrl ?? image.url;
  if (!src) {
    const fallback = toAssetUrl(image.id, 1920);
    return fallback ? { src: fallback } : null;
  }
  // 原本が 960 未満だと card が生成されず、1 候補の w 記述子は意味を持たない
  const srcSet = image.cardUrl
    ? `${toAbsolute(image.cardUrl)} 960w, ${toAbsolute(src)} 1920w`
    : undefined;
  return { src: toAbsolute(src), srcSet };
}
