import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import * as homePageModule from '@/lib/home-page';
import * as phaseModule from '@/lib/phase';
import { HomePageContent } from '@/lib/home-page-types';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/home-page', () => ({
  getHomePage: vi.fn(),
}));

vi.mock('@/lib/phase', () => ({
  resolvePhase: vi.fn(),
  PHASE_OVERRIDE_COOKIE: 'aramakisai_phase_override',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

// 実際の matchMedia/localStorage は use-motion-preference.test.ts が担う。
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => ({ reduced: false, toggle: vi.fn() }),
}));

const content: HomePageContent = {
  heroImages: [
    { id: 'hero-1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
    { id: 'hero-2', filenameDownload: 'hero2.jpg', type: 'image/jpeg' },
  ],
  heroMessageHtml: '<p>ようこそ</p>',
  snsLinks: [{ platform: 'X', url: 'https://x.com' }],
  festival: {
    name: '荒牧祭',
    eventDays: [
      {
        label: '11月14日',
        startAt: '2026-11-14T00:00:00.000Z',
        endAt: '2026-11-14T09:00:00.000Z',
      },
    ],
    overviewHtml: '<p>CMS祭概要</p>',
    heroImageId: null,
  },
  theme: {
    word: '万彩',
    imageId: 'theme-file-id',
    descriptionHtml: '<p>今年のテーマは万彩です。</p>',
  },
  venueName: '群馬大学 荒牧キャンパス',
  campusMapUrl: 'https://www.google.com/maps/embed?pb=!1m2!2m1!1zsomething',
  contactFormUrl: 'https://forms.example.com/contact',
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

describe('Page (開催前フェーズ)', () => {
  beforeEach(() => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'pre_event',
      source: 'constant',
    });
  });

  it('ヒーロー・荒牧祭とは・お知らせの3セクションのみで構成する (要件1.6)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '荒牧祭とは' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'お知らせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();

    // トピックスは開催前フェーズでは非公開のためセクションごと出さない (要件1.9)
    expect(screen.queryByText('トピック1')).not.toBeInTheDocument();
    expect(homePageModule.getHomePage).toHaveBeenCalledWith('pre_event');
  });

  it('page_home.hero_message_html と festival_meta.name を本文に表示しない (要件1.7, 1.8)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    expect(screen.queryByText('ようこそ')).not.toBeInTheDocument();
    // festival_meta.name はページ主見出し (読み上げ専用) にのみ許容され、本文には出ない
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
  });

  it('festival_meta.name が本文に出ない (ページ主見出しにのみ許容、要件1.8)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      festival: {
        ...content.festival!,
        name: '第73回 荒牧祭公式ホームページ',
      },
    });

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: '第73回 荒牧祭公式ホームページ',
      }),
    ).toHaveClass('sr-only');
    expect(
      screen.queryByText('第73回 荒牧祭公式ホームページ', {
        selector: ':not(h1)',
      }),
    ).not.toBeInTheDocument();
  });

  it('本文に開催前フェーズで非公開のページへの導線を持たない (要件1.9)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    for (const href of hrefs) {
      expect(href).not.toMatch(
        /^\/(exhibitions|map|topics|timetable|parking)(\/|$)/,
      );
    }
  });

  it('お知らせを新しい順に5件まで表示する', async () => {
    const announcements = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      title: `お知らせ${i}`,
      body: '',
      publishedAt: '2026-07-01',
      attachments: [],
    }));
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      announcements,
    });

    const ui = await Page();
    render(ui);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(
      screen.getByRole('link', { name: /お知らせ一覧へ/ }),
    ).toHaveAttribute('href', '/announcements');
  });

  it('取得失敗時もページを落とさず、主見出しと空表示が残る (要件20.1, 20.2)', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(
      new Error('CMS Error'),
    );

    const ui = await Page();
    render(ui);

    expect(
      screen.queryByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: '荒牧祭とは' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
  });

  it('festival 領域だけ欠落しても、他の領域とページの主見出しは表示を続ける', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      festival: null,
      theme: null,
      venueName: null,
      campusMapUrl: null,
    });

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: '荒牧祭とは' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
  });

  it('ヒーロー画像URLをCMSアセットURLへ変換してHeroSectionへ渡す', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    const slides = screen.getAllByTestId('hero-slide');
    const images = slides.map((slide) => slide.querySelector('img'));
    expect(images[0]).toHaveAttribute(
      'src',
      'http://localhost:8055/api/media/serve/hero-1/hero',
    );
    expect(images[1]).toHaveAttribute(
      'src',
      'http://localhost:8055/api/media/serve/hero-2/hero',
    );
  });
});

describe('フェーズによるトピックス節の出し分け', () => {
  beforeEach(() => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);
  });

  it('開催前フェーズではトピックス節を描画しない', async () => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'pre_event',
      source: 'constant',
    });

    const ui = await Page();
    render(ui);

    expect(screen.queryByText('トピックス')).not.toBeInTheDocument();
    expect(homePageModule.getHomePage).toHaveBeenCalledWith('pre_event');
  });

  it('開催中フェーズでは従来どおりトピックス節を描画する', async () => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'live',
      source: 'constant',
    });

    const ui = await Page();
    render(ui);

    expect(screen.getByText('トピックス')).toBeInTheDocument();
    expect(homePageModule.getHomePage).toHaveBeenCalledWith('live');
  });
});
