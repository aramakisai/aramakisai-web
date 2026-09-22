import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHomePage } from './home-page';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

type PublishedWhere = { published_at?: { exists?: boolean } };

const META = {
  name: '荒牧祭',
  sns_links: [{ platform: 'twitter', url: 'https://twitter.com' }],
  event_days: [
    {
      label: '1日目',
      start_at: '2026-09-27T00:00:00.000Z',
      end_at: '2026-09-27T08:00:00.000Z',
    },
  ],
  overview_html: '<p>Overview</p>',
  hero_image: { id: 91, filename: 'meta_hero1.webp', mimeType: 'image/webp' },
  theme_word: '万彩',
  theme_image: { id: 92, filename: 'theme.webp', mimeType: 'image/webp' },
  theme_description_html: '<p>Theme description</p>',
  venue_name: '荒牧キャンパス',
  campus_map_url: 'https://www.google.com/maps/embed?pb=xxx',
  contact_form_url: 'https://forms.example.com/contact',
};

const PAGE_HOME = {
  hero_message_html: '<p>Hello</p>',
  hero_images: [
    { id: 1, filename: 'hero1.jpg', mimeType: 'image/jpeg' },
    { id: 2, filename: 'hero2.jpg', mimeType: 'image/jpeg' },
  ],
};

const LISTS: Record<string, unknown[]> = {
  announcements: [
    {
      id: 1,
      title: 'A1',
      body_html: 'B1',
      published_at: '2023-01-01',
      attachments: [
        { id: 11, filename: 'f1.png', mimeType: 'image/png' },
        { id: 12, filename: 'f2.pdf', mimeType: 'application/pdf' },
      ],
    },
  ],
  topics: [
    {
      id: 2,
      title: 'T1',
      body_html: 'B2',
      image: { id: 21, filename: 'img1.webp', mimeType: 'image/webp' },
      attachments: [
        { id: 13, filename: 'f3.pdf', mimeType: 'application/pdf' },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cms.findGlobal).mockImplementation((async (slug: string) => ({
    ok: true,
    value: slug === 'festival_meta' ? META : PAGE_HOME,
  })) as never);
  vi.mocked(cms.findMany).mockImplementation((async (collection: string) => ({
    ok: true,
    value: {
      docs: LISTS[collection] ?? [],
      totalDocs: (LISTS[collection] ?? []).length,
    },
  })) as never);
});

describe('getHomePage', () => {
  it('トップページのコンテンツを組み立てる', async () => {
    const result = await getHomePage('live');

    expect(result.heroMessageHtml).toBe('<p>Hello</p>');
    expect(result.heroImages).toEqual([
      { id: '1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
      { id: '2', filenameDownload: 'hero2.jpg', type: 'image/jpeg' },
    ]);
    expect(result.snsLinks).toEqual([
      { platform: 'twitter', url: 'https://twitter.com' },
    ]);
    expect(result.festival).toEqual({
      name: '荒牧祭',
      eventDays: [
        {
          label: '1日目',
          startAt: '2026-09-27T00:00:00.000Z',
          endAt: '2026-09-27T08:00:00.000Z',
        },
      ],
      overviewHtml: '<p>Overview</p>',
      heroImageId: '91',
    });
    expect(result.theme).toEqual({
      word: '万彩',
      imageId: '92',
      descriptionHtml: '<p>Theme description</p>',
    });
    expect(result.venueName).toBe('荒牧キャンパス');
    expect(result.campusMapUrl).toBe(
      'https://www.google.com/maps/embed?pb=xxx',
    );
    expect(result.contactFormUrl).toBe('https://forms.example.com/contact');
    expect(result.announcements).toEqual([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        publishedAt: '2023-01-01',
        attachments: [
          { id: '11', filenameDownload: 'f1.png', type: 'image/png' },
          { id: '12', filenameDownload: 'f2.pdf', type: 'application/pdf' },
        ],
      },
    ]);
    expect(result.topics).toEqual([
      {
        id: 2,
        title: 'T1',
        body: 'B2',
        imageId: '21',
        attachments: [
          { id: '13', filenameDownload: 'f3.pdf', type: 'application/pdf' },
        ],
      },
    ]);
  });

  it('festival_meta と page_home が null 値でも既定値へ落とす', async () => {
    vi.mocked(cms.findGlobal).mockImplementation((async (slug: string) => ({
      ok: true,
      value:
        slug === 'festival_meta'
          ? {
              name: null,
              sns_links: null,
              event_days: null,
              overview_html: null,
              hero_image: null,
              theme_word: null,
              theme_image: null,
              theme_description_html: null,
              venue_name: null,
              campus_map_url: null,
              contact_form_url: null,
            }
          : { hero_message_html: null, hero_images: [] },
    })) as never);
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { docs: [], totalDocs: 0 },
    } as never);

    const result = await getHomePage('live');

    expect(result.heroMessageHtml).toBeNull();
    expect(result.heroImages).toEqual([]);
    expect(result.snsLinks).toEqual([]);
    expect(result.announcements).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.theme).toEqual({
      word: null,
      imageId: null,
      descriptionHtml: null,
    });
    expect(result.venueName).toBeNull();
    expect(result.campusMapUrl).toBeNull();
    expect(result.contactFormUrl).toBeNull();
  });

  it('announcements は公開済みを新着順に 10 件まで引く', async () => {
    await getHomePage('live');
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'announcements');
    expect(call?.[1].sort).toEqual(['-published_at']);
    expect(call?.[1].limit).toBe(10);
    expect(call?.[1].depth).toBe(1);
    expect((call?.[1].where as PublishedWhere).published_at?.exists).toBe(true);
  });

  it('一覧の取得に失敗しても空配列で描画を継続する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    const result = await getHomePage('live');

    expect(result.announcements).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.heroMessageHtml).toBe('<p>Hello</p>');
  });

  it('festival_meta の取得に失敗しても例外を投げず、festival 由来の領域だけが欠落する', async () => {
    vi.mocked(cms.findGlobal).mockImplementation((async (slug: string) => ({
      ok: slug !== 'festival_meta',
      ...(slug === 'festival_meta'
        ? { error: { kind: 'network', status: 500 } }
        : { value: PAGE_HOME }),
    })) as never);

    const result = await getHomePage('live');

    expect(result.festival).toBeNull();
    expect(result.theme).toBeNull();
    expect(result.snsLinks).toEqual([]);
    expect(result.venueName).toBeNull();
    expect(result.campusMapUrl).toBeNull();
    expect(result.contactFormUrl).toBeNull();
    // festival_meta とは無関係な領域は取得できたとおりに残る
    expect(result.heroMessageHtml).toBe('<p>Hello</p>');
    expect(result.announcements).toHaveLength(1);
  });

  it('page_home の取得に失敗しても例外を投げず、hero 由来の領域だけが欠落する', async () => {
    vi.mocked(cms.findGlobal).mockImplementation((async (slug: string) => ({
      ok: slug !== 'page_home',
      ...(slug === 'page_home'
        ? { error: { kind: 'network', status: 500 } }
        : { value: META }),
    })) as never);

    const result = await getHomePage('live');

    expect(result.heroImages).toEqual([]);
    expect(result.heroMessageHtml).toBeNull();
    // page_home とは無関係な領域は取得できたとおりに残る
    expect(result.festival).not.toBeNull();
    expect(result.venueName).toBe('荒牧キャンパス');
  });

  it('festival_meta と page_home の両方が失敗しても例外を投げない', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getHomePage('live')).resolves.toMatchObject({
      festival: null,
      theme: null,
      heroImages: [],
      heroMessageHtml: null,
    });
  });
});

describe('getHomePage の phase 引数によるトピックス取得の抑止', () => {
  it('開催前フェーズでは topics を取得せず空配列を返す', async () => {
    const result = await getHomePage('pre_event');

    expect(result.topics).toEqual([]);
    expect(cms.findMany).not.toHaveBeenCalledWith('topics', expect.anything());
  });

  it('topics は公開済みを公開日時の新しい順に取得する', async () => {
    await getHomePage('live');
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'topics');
    expect(call?.[1].sort).toEqual(['-published_at']);
    expect((call?.[1].where as PublishedWhere).published_at?.exists).toBe(true);
  });

  it('開催中フェーズでは従来どおり topics を取得する', async () => {
    const result = await getHomePage('live');

    expect(result.topics).toEqual([
      {
        id: 2,
        title: 'T1',
        body: 'B2',
        imageId: '21',
        attachments: [
          { id: '13', filenameDownload: 'f3.pdf', type: 'application/pdf' },
        ],
      },
    ]);
  });
});
