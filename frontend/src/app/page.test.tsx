import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';
import * as homePageModule from '@/lib/home-page';
import { HomePageContent } from '@/lib/home-page-types';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/home-page', () => ({
  getHomePage: vi.fn(),
}));

describe('Page', () => {
  it('Hero直後に荒牧祭についてを表示し、既存のDirectusコンテンツも維持する', async () => {
    const content: HomePageContent = {
      heroImages: [
        { id: 'hero-1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
      ],
      heroMessageHtml: '<p>ようこそ</p>',
      snsLinks: [{ platform: 'X', url: 'https://x.com' }],
      festival: {
        name: '荒牧祭',
        eventDays: [{ label: 'CMS開催日', open: '09:00', close: '18:00' }],
        overviewHtml: '<p>CMS祭概要</p>',
        heroImageId: null,
      },
      sponsors: [],
      announcements: [
        {
          id: 1,
          title: 'お知らせ1',
          body: '本文',
          publishedAt: '2026-07-01',
          attachments: [],
        },
      ],
      topics: [
        {
          id: 1,
          title: 'トピック1',
          body: '本文',
          imageId: 'img-1',
          attachments: [],
        },
      ],
    };

    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /枚目の画像を表示/ }),
    ).toHaveLength(5);
    expect(screen.getByText('SCROLL')).toBeInTheDocument();

    const hero = screen.getByRole('region', {
      name: '荒牧祭の写真スライドショー',
    });
    const about = screen.getByRole('region', { name: '荒牧祭について' });
    expect(hero.nextElementSibling).toBe(about);
    expect(about).toHaveAttribute('id', 'about');

    expect(screen.getByText('ようこそ')).toBeInTheDocument();
    expect(screen.getByText('CMS開催日')).toBeInTheDocument();
    expect(screen.getByText('CMS祭概要')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('トピックス')).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
  });

  it('Directus取得エラー時もHeroと荒牧祭についてを表示し、旧可視見出しは表示しない', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(
      new Error('Directus Error'),
    );

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '荒牧祭について' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
  });
});
