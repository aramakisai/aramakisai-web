import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import * as homePageModule from '@/lib/home-page';
import { env } from '@/env';
import { PreEventHomeContent, HomePageContent } from '@/lib/home-page-types';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE: undefined as
      'true' | undefined,
  },
}));

function noSearchParams() {
  return { searchParams: Promise.resolve({}) };
}

afterEach(() => {
  Object.defineProperty(env, 'NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE', {
    value: undefined,
    writable: true,
  });
});

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
      festival: {
        name: '荒牧祭',
        eventDays: [],
        admissionFee: null,
        paymentNote: null,
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
          linkUrl: null,
          attachments: [],
        },
      ],
    };

    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'pre_event',
      content: preEventContent,
    });

    const ui = await Page(noSearchParams());
    render(ui);

    expect(screen.getByText('荒牧祭')).toBeInTheDocument();
    expect(screen.getByText('プレイベント')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('liveの場合、ヒーロー・SNS・お知らせが表示され、トピックスは表示されない', async () => {
    const liveContent: HomePageContent = {
      heroImageId: 'hero-live',
      heroMessageHtml: '<p>ライブ中</p>',
      embedUrl: null,
      snsLinks: [{ platform: 'X', url: 'https://x.com' }],
      festival: {
        name: '荒牧祭',
        eventDays: [],
        admissionFee: null,
        paymentNote: null,
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
    };

    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'live',
      content: liveContent,
    });

    const ui = await Page(noSearchParams());
    render(ui);

    expect(screen.getByText('荒牧祭')).toBeInTheDocument();
    expect(screen.getByText('ライブ中')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();

    expect(screen.queryByText('トピックス')).not.toBeInTheDocument();
  });

  it('getHomePageがエラーをthrowした場合、クラッシュせずに荒牧祭の見出しが表示される', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(
      new Error('Directus Error'),
    );

    const ui = await Page(noSearchParams());
    render(ui);

    expect(screen.getByRole('main')).toHaveTextContent('荒牧祭');
    expect(screen.queryByText('公式SNS')).not.toBeInTheDocument();
  });

  it('クエリオーバーライドが無効な場合、?home_variant=liveがあってもgetHomePageへ渡されない', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'pre_event',
      content: {
        heroImageId: null,
        heroMessageHtml: '',
        embedUrl: null,
        snsLinks: [],
        festival: {
          name: '',
          eventDays: [],
          admissionFee: null,
          paymentNote: null,
          overviewHtml: null,
          heroImageId: null,
        },
        sponsors: [],
        announcements: [],
        topics: [],
      },
    });

    const ui = await Page({
      searchParams: Promise.resolve({ home_variant: 'live' }),
    });
    render(ui);

    expect(homePageModule.getHomePage).toHaveBeenCalledWith(undefined);
  });

  it('クエリオーバーライドが有効な場合、?home_variant=liveがgetHomePageへ渡される', async () => {
    Object.defineProperty(
      env,
      'NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE',
      {
        value: 'true',
        writable: true,
      },
    );

    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      variant: 'live',
      content: {
        heroImageId: null,
        heroMessageHtml: '',
        embedUrl: null,
        snsLinks: [],
        festival: {
          name: '',
          eventDays: [],
          admissionFee: null,
          paymentNote: null,
          overviewHtml: null,
          heroImageId: null,
        },
        sponsors: [],
        announcements: [],
      },
    });

    const ui = await Page({
      searchParams: Promise.resolve({ home_variant: 'live' }),
    });
    render(ui);

    expect(homePageModule.getHomePage).toHaveBeenCalledWith('live');
  });
});
