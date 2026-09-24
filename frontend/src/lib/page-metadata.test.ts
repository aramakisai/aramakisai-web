import { describe, expect, it, vi } from 'vitest';
import {
  buildPageMetadata,
  DEFAULT_OG_IMAGE,
  PageMetadataInput,
} from './page-metadata';
import type { SiteMetadata } from './site-metadata';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

const SITE: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: 'http://localhost:3100/api/media/serve/999/card',
  festival: null,
};

function baseInput(
  overrides: Partial<PageMetadataInput> = {},
): PageMetadataInput {
  return {
    site: SITE,
    title: 'お知らせ',
    description: 'お知らせの説明文',
    path: '/announcements',
    ogType: 'website',
    imageCandidates: [],
    ...overrides,
  };
}

describe('buildPageMetadata', () => {
  it('openGraph の全キーを毎回完全な形で返す', () => {
    const metadata = buildPageMetadata(baseInput());

    expect(metadata.openGraph).toMatchObject({
      siteName: '荒牧祭',
      locale: 'ja_JP',
      type: 'website',
      url: '/announcements',
      title: 'お知らせ',
      description: 'お知らせの説明文',
    });
    expect(metadata.openGraph?.images).toHaveLength(1);
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.twitter?.images).toHaveLength(1);
  });

  it('title が null (root layout) の場合は title.default/template を出し robots を設定する', () => {
    const metadata = buildPageMetadata(
      baseInput({ title: null, description: null, path: null }),
    );

    expect(metadata.title).toEqual({
      default: '荒牧祭',
      template: '%s | 荒牧祭',
    });
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('title がサイトタイトルと一致する場合は absolute にして template による二重化を防ぐ', () => {
    const metadata = buildPageMetadata(baseInput({ title: SITE.siteTitle }));

    expect(metadata.title).toEqual({ absolute: SITE.siteTitle });
  });

  it('title が文字列のページでは robots を設定しない (root の継承に任せる)', () => {
    const metadata = buildPageMetadata(baseInput());

    expect(metadata.robots).toBeUndefined();
  });

  it('path が非 null なら canonical を設定する', () => {
    const metadata = buildPageMetadata(baseInput({ path: '/announcements' }));

    expect(metadata.alternates?.canonical).toBe('/announcements');
  });

  it('path が null (root layout) なら canonical を出さない', () => {
    const metadata = buildPageMetadata(baseInput({ path: null }));

    expect(metadata.alternates).toBeUndefined();
  });

  it('画像優先度1: ページ固有の og_image があれば最優先で使う', () => {
    const metadata = buildPageMetadata(
      baseInput({ imageCandidates: ['111', '222'] }),
    );

    expect(metadata.openGraph?.images).toEqual([
      { url: 'http://localhost:3100/api/media/serve/111/card' },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'http://localhost:3100/api/media/serve/111/card',
    ]);
  });

  it('画像優先度2: ページ固有が無ければ本文の画像を使う', () => {
    const metadata = buildPageMetadata(
      baseInput({ imageCandidates: [null, '222'] }),
    );

    expect(metadata.openGraph?.images).toEqual([
      { url: 'http://localhost:3100/api/media/serve/222/card' },
    ]);
  });

  it('画像優先度3: ページ側の候補が無ければサイト既定 (CMS) を使う', () => {
    const metadata = buildPageMetadata(
      baseInput({ imageCandidates: [null, null] }),
    );

    expect(metadata.openGraph?.images).toEqual([{ url: SITE.ogImageUrl }]);
  });

  it('画像優先度4: サイト既定も無ければ静的既定画像を 1200x630 で使う', () => {
    const metadata = buildPageMetadata(
      baseInput({
        site: { ...SITE, ogImageUrl: null },
        imageCandidates: [null, null],
      }),
    );

    expect(metadata.openGraph?.images).toEqual([DEFAULT_OG_IMAGE]);
    expect(metadata.twitter?.images).toEqual([DEFAULT_OG_IMAGE.url]);
  });

  it('description が null ならサイト既定の説明文を使う', () => {
    const metadata = buildPageMetadata(baseInput({ description: null }));

    expect(metadata.description).toBe(SITE.description);
    expect(metadata.openGraph?.description).toBe(SITE.description);
  });
});
