import type { Metadata } from 'next';
import { toAssetUrl } from './cms-asset-url';
import type { SiteMetadata } from './site-metadata';

/** CMS media ID。null は候補なしを表す */
export type OgImageCandidate = string | null;

export const DEFAULT_OG_IMAGE = {
  url: '/images/og-default.png',
  width: 1200,
  height: 630,
} as const;

export interface PageMetadataInput {
  readonly site: SiteMetadata;
  /** null は root layout (title.default/template を出す) */
  readonly title: string | null;
  readonly description: string | null;
  /** クエリ無しの正規パス ('/' 始まり)。null なら canonical を出さない */
  readonly path: string | null;
  readonly ogType: 'website' | 'article';
  /** 優先度順。先頭から最初の非 null を採用 */
  readonly imageCandidates: readonly OgImageCandidate[];
}

function resolveOgImage(input: PageMetadataInput): {
  url: string;
  width?: number;
  height?: number;
} {
  for (const candidate of input.imageCandidates) {
    const url = toAssetUrl(candidate, 960);
    if (url) return { url };
  }
  if (input.site.ogImageUrl) return { url: input.site.ogImageUrl };
  return { ...DEFAULT_OG_IMAGE };
}

/**
 * Next.js のメタデータは子が openGraph/twitter を返すと親のそれを丸ごと
 * 置き換える (浅いマージ)。siteName や画像の欠落を防ぐため、呼び出しごとに
 * 全キーを埋めて返す。
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const title = input.title ?? input.site.siteTitle;
  const description = input.description ?? input.site.description;
  const image = resolveOgImage(input);
  const url = input.path ?? '/';

  const metadata: Metadata = {
    // title がサイトタイトルそのもの (トップページ、または詳細ページの not-found 退避) の場合、
    // 通常の文字列 title を返すと root layout の template ('%s | サイトタイトル') が適用され
    // 「サイトタイトル | サイトタイトル」に二重化する。absolute で template を無効化する
    title:
      input.title === null
        ? {
            default: input.site.siteTitle,
            template: `%s | ${input.site.siteTitle}`,
          }
        : input.title === input.site.siteTitle
          ? { absolute: input.title }
          : input.title,
    description,
    openGraph: {
      type: input.ogType,
      siteName: input.site.siteTitle,
      locale: 'ja_JP',
      url,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };

  if (input.path !== null) {
    metadata.alternates = { canonical: input.path };
  }

  // root layout (title === null) でのみ明示する。子ページは何も返さず継承させる
  if (input.title === null) {
    metadata.robots = { index: true, follow: true };
  }

  return metadata;
}
