import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import * as homePageModule from '@/lib/home-page';
import * as phaseModule from '@/lib/phase';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as sponsorsModule from '@/lib/sponsors';
import { HomePageContent } from '@/lib/home-page-types';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

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

vi.mock('@/lib/exhibitions', async () => {
  const actual =
    await vi.importActual<typeof exhibitionsModule>('@/lib/exhibitions');
  return { ...actual, getExhibitionListData: vi.fn() };
});

vi.mock('@/lib/sponsors', async () => {
  const actual = await vi.importActual<typeof sponsorsModule>('@/lib/sponsors');
  return { ...actual, getSponsors: vi.fn() };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

// 実際の matchMedia/localStorage は use-motion-preference.test.ts が担う。
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => ({ reduced: false, toggle: vi.fn() }),
}));

const content: HomePageContent = {
  heroImages: [
    {
      id: 'hero-1',
      filenameDownload: 'hero1.jpg',
      type: 'image/jpeg',
      filesize: null,
    },
    {
      id: 'hero-2',
      filenameDownload: 'hero2.jpg',
      type: 'image/jpeg',
      filesize: null,
    },
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
  accessSummary: '最寄駅から徒歩10分',
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

function makeExhibition(id: number): ExhibitionCardSummary {
  return {
    id,
    category: 'exhibit',
    displayName: `企画${id}`,
    organizationName: `団体${id}`,
    location: null,
    areaIds: [],
    thumbnail: null,
  };
}

describe('Page (開催中フェーズ)', () => {
  beforeEach(() => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'live',
      source: 'constant',
    });
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageCount: 0,
      rangeStart: 0,
      rangeEnd: 0,
      areas: [],
    });
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({
      ok: true,
      value: { ad: [], local: [], vendor: [], other: [] },
    });
  });

  it('8セクションをヒーロー→トピック→主要導線→企画→お知らせ→荒牧祭とは→アクセス→協賛の順で表示する (要件3.4-3.10)', async () => {
    const ui = await Page();
    const { container } = render(ui);

    expect(homePageModule.getHomePage).toHaveBeenCalledWith('live');
    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toBeInTheDocument();

    const headings = [
      'トピック',
      '会場で使う',
      '企画',
      'お知らせ',
      '荒牧祭とは',
      'アクセス',
      '協賛',
    ];
    for (const heading of headings) {
      expect(
        screen.getByRole('heading', { level: 2, name: heading }),
      ).toBeInTheDocument();
    }
    const html = container.innerHTML;
    const positions = headings.map((h) => html.indexOf(`>${h}<`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('festival_meta.name を本文に表示しない (要件3.10)', async () => {
    const ui = await Page();
    render(ui);

    expect(
      screen.queryByText('荒牧祭', { selector: ':not(.sr-only)' }),
    ).not.toBeInTheDocument();
  });

  it('トピックが0件のときトピック節をセクションごと出さない (要件3.6)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      topics: [],
    });

    const ui = await Page();
    render(ui);

    expect(
      screen.queryByRole('heading', { level: 2, name: 'トピック' }),
    ).not.toBeInTheDocument();
  });

  it('ヒーローを開催中仕様 (前後矢印なし) で描画する (要件3.9)', async () => {
    const ui = await Page();
    render(ui);

    expect(
      screen.queryByRole('button', { name: '前の画像を表示' }),
    ).not.toBeInTheDocument();
  });

  it('企画の検索欄と、取得した企画からのカードを表示する (要件3.2)', async () => {
    const exhibitions = [makeExhibition(1), makeExhibition(2)];
    vi.mocked(exhibitionsModule.getExhibitionListData).mockResolvedValue({
      items: exhibitions,
      total: 2,
      page: 1,
      pageCount: 1,
      rangeStart: 1,
      rangeEnd: 2,
      areas: [],
    });

    const ui = await Page();
    render(ui);

    expect(
      screen.getByPlaceholderText('企画名・団体名で検索'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '企画1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '企画2' })).toBeInTheDocument();
  });

  it('企画一覧の取得に失敗しても検索欄と導線は残る (要件3.2)', async () => {
    vi.mocked(exhibitionsModule.getExhibitionListData).mockRejectedValue(
      new Error('CMS Error'),
    );

    const ui = await Page();
    render(ui);

    expect(
      screen.getByPlaceholderText('企画名・団体名で検索'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /企画一覧へ/ })).toHaveAttribute(
      'href',
      '/exhibitions',
    );
  });

  it('会場で使うの4種の主要導線を表示する (要件3.2)', async () => {
    const ui = await Page();
    render(ui);

    const section = screen
      .getByRole('heading', { level: 2, name: '会場で使う' })
      .closest('section')!;
    const links = within(section).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/exhibitions',
      '/map',
      '/timetable',
      '/parking',
    ]);
  });

  it('アクセスに festival_meta.access_summary を表示する (要件3.11)', async () => {
    const ui = await Page();
    render(ui);

    expect(screen.getByTestId('access-summary')).toHaveTextContent(
      '最寄駅から徒歩10分',
    );
  });

  it('協賛を種別をまたいで重複なく統合して表示する (要件3.3)', async () => {
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({
      ok: true,
      value: {
        ad: [{ id: 1, name: 'S1', logoId: null, url: null, tier: null }],
        local: [
          { id: 1, name: 'S1', logoId: null, url: null, tier: null },
          { id: 2, name: 'S2', logoId: null, url: null, tier: null },
        ],
        vendor: [],
        other: [],
      },
    });

    const ui = await Page();
    render(ui);

    const section = screen
      .getByRole('heading', { level: 2, name: '協賛' })
      .closest('section')!;
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);
  });

  it('協賛の取得に失敗してもページの表示が続く (要件3.3)', async () => {
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({ ok: false });

    const ui = await Page();
    render(ui);

    expect(
      screen.getByRole('heading', { level: 2, name: '協賛' }),
    ).toBeInTheDocument();
  });
});
