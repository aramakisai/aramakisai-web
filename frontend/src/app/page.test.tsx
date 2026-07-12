import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';
import * as homePageModule from '@/lib/home-page';
import { PreEventHomeContent, HomePageContent } from '@/lib/home-page-types';

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
  it('pre_eventの場合、ヒーロー・お知らせ・トピックス・SNSがすべて表示される', async () => {
    const preEventContent: PreEventHomeContent = {
      heroImageId: 'hero-1',
      heroMessageHtml: '<p>プレイベント</p>',
      embedUrl: null,
      snsLinks: [{ platform: 'X', url: 'https://x.com' }],
      notices: [{ id: 1, title: 'お知らせ1', body: '本文', publishedAt: '2026-07-01' }],
      topics: [{ id: 1, title: 'トピック1', body: '本文', imageId: 'img-1', linkUrl: null }],
    };

    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'pre_event',
      content: preEventContent,
    });

    const ui = await Page();
    render(ui);

    expect(screen.getByText('荒牧祭')).toBeInTheDocument();
    expect(screen.getByText('プレイベント')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('liveの場合、ヒーローとSNSのみ表示され、お知らせ・トピックスは表示されない', async () => {
    const liveContent: HomePageContent = {
      heroImageId: 'hero-live',
      heroMessageHtml: '<p>ライブ中</p>',
      embedUrl: null,
      snsLinks: [{ platform: 'X', url: 'https://x.com' }],
    };

    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'live',
      content: liveContent,
    });

    const ui = await Page();
    render(ui);

    expect(screen.getByText('荒牧祭')).toBeInTheDocument();
    expect(screen.getByText('ライブ中')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();

    expect(screen.queryByText('お知らせ')).not.toBeInTheDocument();
    expect(screen.queryByText('トピックス')).not.toBeInTheDocument();
  });

  it('getHomePageがエラーをthrowした場合、クラッシュせずに荒牧祭の見出しが表示される', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(new Error('Directus Error'));

    const ui = await Page();
    render(ui);

    expect(screen.getByRole('main')).toHaveTextContent('荒牧祭');
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
  });
});
