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
  it('ヒーロー・お知らせ・トピックスが表示される', async () => {
    const content: HomePageContent = {
      heroImages: [
        { id: 'hero-1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
      ],
      heroMessageHtml: '<p>ようこそ</p>',
      snsLinks: [{ platform: 'X', url: 'https://x.com' }],
      festival: {
        name: '荒牧祭',
        eventDays: [],
        overviewHtml: null,
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

    expect(screen.getByText('荒牧祭')).toBeInTheDocument();
    expect(screen.getByText('ようこそ')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('トピックス')).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
  });

  it('getHomePageがエラーをthrowした場合、クラッシュせずに荒牧祭の見出しが表示される', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(
      new Error('Directus Error'),
    );

    const ui = await Page();
    render(ui);

    expect(screen.getByRole('main')).toHaveTextContent('荒牧祭');
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
  });
});
