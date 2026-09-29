import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMetadata } from './not-found';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('固有タイトル・説明文を返し、canonical は出さない', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('ページが見つかりません');
    expect(metadata.description).toBe(
      'お探しのページは移動または削除された可能性があります。',
    );
    expect(metadata.alternates).toBeUndefined();
  });

  it('検索エンジンにインデックスさせない', async () => {
    const metadata = await generateMetadata();

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
