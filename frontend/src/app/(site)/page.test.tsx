import { render, screen, within } from '@testing-library/react';
import { ACCESS_SUMMARY, CAMPUS_MAP_EMBED_URL, VENUE_NAME } from '@/lib/venue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page, { generateMetadata } from './page';
import * as homePageModule from '@/lib/home-page';
import * as phaseModule from '@/lib/request-phase';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as sponsorsModule from '@/lib/sponsors';
import * as regionalSponsorsModule from '@/lib/regional-sponsors';
import * as siteMetadataModule from '@/lib/site-metadata';
import { HomePageContent } from '@/lib/home-page-types';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/home-page', () => ({
  getHomePage: vi.fn(),
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

vi.mock('@/lib/request-phase', () => ({
  getRequestPhase: vi.fn(),
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

vi.mock('@/lib/regional-sponsors', async () => {
  const actual = await vi.importActual<typeof regionalSponsorsModule>(
    '@/lib/regional-sponsors',
  );
  return { ...actual, getRegionalSponsorMapData: vi.fn() };
});

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
  },
  theme: {
    word: '万彩',
    descriptionHtml: '<p>今年のテーマは万彩です。</p>',
  },
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
    },
  ],
};

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

beforeEach(() => {
  vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
    SITE_METADATA,
  );
});

describe('Page (開催前フェーズ)', () => {
  beforeEach(() => {
    vi.mocked(phaseModule.getRequestPhase).mockResolvedValue({
      phase: 'pre_event',
      source: 'constant',
    });
  });

  it('テーマ趣旨文を荒牧祭とはの直後に表示する', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    const { container } = render(ui);

    const about = container.querySelector('#about');
    expect(about?.nextElementSibling).toBe(container.querySelector('#theme'));
    expect(
      screen.getByRole('heading', { level: 2, name: 'テーマ「万彩」' }),
    ).toBeInTheDocument();
  });

  it('テーマ情報が無いときは趣旨文セクションを出さない', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      theme: null,
    });
    const ui = await Page();
    const { container } = render(ui);

    expect(container.querySelector('#theme')).toBeNull();
  });

  it('ヒーロー・トピック・荒牧祭とは・お知らせのみで構成する (要件1.6)', async () => {
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

    expect(
      screen.getByRole('heading', { level: 2, name: 'トピック' }),
    ).toBeInTheDocument();
    expect(screen.getByText('トピック1')).toBeInTheDocument();
  });

  it('site_settings.name を本文に表示しない (要件1.7, 1.8)', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);

    const ui = await Page();
    render(ui);

    // site_settings.name はページ主見出し (読み上げ専用) にのみ許容され、本文には出ない
    expect(
      screen.getByRole('heading', { level: 1, name: '荒牧祭' }),
    ).toHaveClass('sr-only');
  });

  it('site_settings.name が本文に出ない (ページ主見出しにのみ許容、要件1.8)', async () => {
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
      expect(href).not.toMatch(/^\/(exhibitions|map|timetable|parking)(\/|$)/);
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

it('keeps personal sponsors out of the home sponsor list', async () => {
  vi.mocked(phaseModule.getRequestPhase).mockResolvedValue({
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
  vi.mocked(regionalSponsorsModule.getRegionalSponsorMapData).mockResolvedValue(
    {
      ok: true,
      sponsors: [],
    },
  );
  const { cms } = await import('@/lib/cms');
  const { getSponsors } =
    await vi.importActual<typeof sponsorsModule>('@/lib/sponsors');
  const findMany = vi
    .spyOn(cms, 'findMany')
    .mockImplementation(async (collection) => {
      if (collection === 'sponsors') {
        return {
          ok: true,
          value: {
            totalDocs: 2,
            docs: [
              {
                id: 1,
                type: ['ad'],
                name: 'Company Logo',
                logo: 11,
                tier: 'planA',
              },
              {
                id: 2,
                type: ['ad'],
                name: 'Company Name',
                logo: null,
                tier: 'planD',
              },
            ],
          },
        } as never;
      }
      if (collection === 'personal_sponsors') {
        return {
          ok: true,
          value: { totalDocs: 1, docs: [{ id: 3, name: 'Personal Sponsor' }] },
        } as never;
      }
      throw new Error(`Unexpected collection: ${collection}`);
    });
  vi.mocked(sponsorsModule.getSponsors).mockImplementation(getSponsors);
  try {
    render(await Page());
    expect(screen.getAllByAltText('Company Logo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Company Name').length).toBeGreaterThan(0);
    expect(screen.queryByText('Personal Sponsor')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '広告協賛へ' })).toHaveAttribute(
      'href',
      '/sponsors/ad',
    );
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      'sponsors',
      { sort: ['_order'], limit: 0, depth: 1 },
      undefined,
    );
  } finally {
    findMany.mockRestore();
  }
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
    vi.mocked(phaseModule.getRequestPhase).mockResolvedValue({
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
    vi.mocked(
      regionalSponsorsModule.getRegionalSponsorMapData,
    ).mockResolvedValue({ ok: true, sponsors: [] });
  });

  it('テーマ趣旨文を荒牧祭とはの直後に表示する', async () => {
    const ui = await Page();
    const { container } = render(ui);

    const about = container.querySelector('#about');
    expect(about?.nextElementSibling).toBe(container.querySelector('#theme'));
    expect(
      screen.getByRole('heading', { level: 2, name: 'テーマ「万彩」' }),
    ).toBeInTheDocument();
  });

  it('テーマ情報が無いときは趣旨文セクションを出さない', async () => {
    vi.mocked(homePageModule.getHomePage).mockResolvedValue({
      ...content,
      theme: null,
    });
    const ui = await Page();
    const { container } = render(ui);

    expect(container.querySelector('#theme')).toBeNull();
  });

  it('8セクションをヒーロー→トピック→主要導線→企画→お知らせ→荒牧祭とは→アクセス→協賛の順で表示する (要件3.4-3.10)', async () => {
    const ui = await Page();
    const { container } = render(ui);

    expect(homePageModule.getHomePage).toHaveBeenCalledWith();
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

  it('site_settings.name を本文に表示しない (要件3.10)', async () => {
    // ヒーローの固定ブランド文言 (CMS 非依存、開催前後で共通) と衝突しないよう、
    // site_settings.name には区別できる値を与えて検証する (開催前フェーズのテストと同じ手法)
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
      screen.queryByText('第73回 荒牧祭公式ホームページ', {
        selector: ':not(.sr-only)',
      }),
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

  it('アクセスの会場名・文言・地図をCMSの値に依らず固定値で表示する', async () => {
    const ui = await Page();
    const { container } = render(ui);

    expect(screen.getByTestId('access-venue-name')).toHaveTextContent(
      VENUE_NAME,
    );
    expect(screen.getByTestId('access-summary')).toHaveTextContent(
      ACCESS_SUMMARY,
    );
    expect(
      container.querySelector(`iframe[src="${CAMPUS_MAP_EMBED_URL}"]`),
    ).not.toBeNull();
  });

  it('広告協賛を帯に、地域協賛をカードに表示する', async () => {
    vi.mocked(sponsorsModule.getSponsors).mockResolvedValue({
      ok: true,
      value: {
        ad: [
          {
            id: 1,
            name: 'S1',
            logoId: null,
            logoWidth: null,
            logoHeight: null,
            url: null,
            tier: 'planD',
          },
        ],
        local: [],
        vendor: [],
        other: [],
      },
    });
    vi.mocked(
      regionalSponsorsModule.getRegionalSponsorMapData,
    ).mockResolvedValue({
      ok: true,
      sponsors: [
        {
          id: 2,
          name: 'L2',
          category: 'food',
          latitude: 0,
          longitude: 0,
          address: null,
          imageId: null,
          imageAlt: null,
          imageDecorative: true,
          message: null,
          businessHours: null,
          phone: null,
          websiteUrl: null,
        },
      ],
    });

    const ui = await Page();
    render(ui);

    const section = screen
      .getByRole('heading', { level: 2, name: '協賛' })
      .closest('section')!;
    expect(within(section).getAllByText('S1')).toHaveLength(2);
    expect(within(section).getByText('L2')).toBeInTheDocument();
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

describe('generateMetadata (要件2.1)', () => {
  it('title にサイトタイトルを、description にサイト既定値を、canonical に "/" を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(metadata.description).toBe('荒牧祭公式サイト');
    expect(metadata.alternates).toEqual({ canonical: '/' });
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: '荒牧祭',
    });
    // root layout (title: null) と異なり子ページのため robots は明示しない (継承させる)
    expect(metadata.robots).toBeUndefined();
  });
});

describe('トップページの JSON-LD (要件5.1, 5.5)', () => {
  beforeEach(() => {
    vi.mocked(phaseModule.getRequestPhase).mockResolvedValue({
      phase: 'pre_event',
      source: 'constant',
    });
    vi.mocked(homePageModule.getHomePage).mockResolvedValue(content);
  });

  it('開催日程があれば Event と Organization を @graph にまとめた ld+json を出力する', async () => {
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue({
      ...SITE_METADATA,
      festival: {
        name: '荒牧祭',
        eventDays: [
          {
            label: null,
            startAt: '2026-10-10T09:00:00+09:00',
            endAt: '2026-10-11T17:00:00+09:00',
          },
        ],
        overviewHtml: null,
        ogImageId: null,
        snsLinks: [],
      },
    });

    const ui = await Page();
    const { container } = render(ui);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? '{}');
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@graph']).toHaveLength(2);
    expect(data['@graph'][0]['@type']).toBe('Event');
    expect(data['@graph'][1]['@type']).toBe('Organization');
  });

  it('開催日程が無くても Organization だけを @graph に出力し、全体の出力を止めない', async () => {
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
      SITE_METADATA,
    );

    const ui = await Page();
    const { container } = render(ui);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? '{}');
    expect(data['@graph']).toHaveLength(1);
    expect(data['@graph'][0]['@type']).toBe('Organization');
  });
});
