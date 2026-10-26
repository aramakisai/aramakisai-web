import { describe, it, expect, vi } from 'vitest';
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
  it('準備中のタイトルを返し、インデックスさせない', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('準備中');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
