import { render, screen, within } from '@testing-library/react';
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

const content: HomePageContent = {
  heroImages: [
    { id: 'hero-1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
    { id: 'hero-2', filenameDownload: 'hero2.jpg', type: 'image/jpeg' },
  ],
  heroMessageHtml: '<p>ようこそ</p>',
  snsLinks: [{ platform: 'X', url: 'https://x.com' }],
  festival: {
    name: '荒牧祭',
    eventDays: [{ label: '11月14日', open: '09:00', close: '18:00' }],
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

describe('Page', () => {
  it('Hero直後に荒牧祭についてを表示し、開催日程・祭概要が1箇所にのみ描画される', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    const hero = screen.getByRole('region', {
      name: '荒牧祭の写真スライドショー',
    });
    expect(
      screen.getAllByRole('button', { name: /枚目の画像を表示/ }),
    ).toHaveLength(2);

    const about = screen.getByRole('region', { name: '荒牧祭について' });
    expect(hero.nextElementSibling).toBe(about);
    expect(about).toHaveAttribute('id', 'about');

    // FestivalOverview / FestivalSummary の旧見出しが重複描画されない
    expect(screen.queryByText('開催日程')).not.toBeInTheDocument();
    expect(screen.getAllByText('11月14日')).toHaveLength(1);
    expect(screen.getAllByText('CMS祭概要')).toHaveLength(1);

    expect(screen.getByText('ようこそ')).toBeInTheDocument();
    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('トピックス')).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();

    // テーマ・会場名・キャンパスマップがDirectus取得データから描画される
    expect(within(about).getByTestId('theme-word')).toHaveTextContent('万彩');
    expect(
      within(about).getByText('群馬大学 荒牧キャンパス'),
    ).toBeInTheDocument();
    expect(within(about).getByTestId('campus-map')).toHaveAttribute(
      'src',
      content.campusMapUrl,
    );
  });

  it('ヒーロー画像URLをDirectusアセットURLへ変換してHeroSectionへ渡す', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    const slides = screen.getAllByTestId('hero-slide');
    const images = slides.map((slide) => slide.querySelector('img'));
    expect(images[0]).toHaveAttribute(
      'src',
      'http://localhost:8055/assets/hero-1?format=webp',
    );
    expect(images[1]).toHaveAttribute(
      'src',
      'http://localhost:8055/assets/hero-2?format=webp',
    );
  });

  it('Directus取得エラー時はDirectus由来の領域を描画せず、ページを落とさない', async () => {
    vi.mocked(homePageModule.getHomePage).mockRejectedValue(
      new Error('Directus Error'),
    );

    const ui = await Page();
    render(ui);

    expect(
      screen.queryByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: '荒牧祭について' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText('お知らせ1')).not.toBeInTheDocument();
  });
});
