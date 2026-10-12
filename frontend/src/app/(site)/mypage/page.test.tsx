import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MypagePage, { generateMetadata, revalidate } from './page';
import { getExhibitionCatalog } from '@/lib/exhibitions';

vi.mock('@/lib/exhibitions', async (orig) => ({
  ...(await orig<typeof import('@/lib/exhibitions')>()),
  getExhibitionCatalog: vi.fn(),
}));
vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

describe('MypagePage', () => {
  it('ISR 60秒', () => {
    expect(revalidate).toBe(60);
  });

  it('stage を除いた企画名を持つ画面を描画する', async () => {
    vi.mocked(getExhibitionCatalog).mockResolvedValue({
      cards: [
        {
          id: 1,
          category: 'stage',
          displayName: 'ステージ',
          areaIds: [1],
        },
        { id: 2, category: 'exhibit', displayName: '展示', areaIds: [1] },
      ],
      areas: [{ id: 1, name: '中央エリア' }],
    } as never);
    render(await MypagePage());
    expect(
      screen.getByRole('heading', { level: 1, name: 'マイページ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('中央エリア')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('メタデータは /mypage を指す', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('マイページ');
  });
});
