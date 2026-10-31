import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHomePage } from './home-page';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

type PublishedWhere = { published_at?: { exists?: boolean } };

const SETTINGS = {
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
  theme_word: '万彩',
  theme_description_html: '<p>Theme description</p>',
  contact_form_url: 'https://forms.example.com/contact',
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
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cms.findGlobal).mockImplementation((async () => ({
    ok: true,
    value: SETTINGS,
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
    const result = await getHomePage();

    expect(result.heroImages).toEqual([
      {
        id: '1',
        filenameDownload: 'hero1.jpg',
        type: 'image/jpeg',
        filesize: null,
      },
      {
        id: '2',
        filenameDownload: 'hero2.jpg',
        type: 'image/jpeg',
        filesize: null,
      },
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
    });
    expect(result.theme).toEqual({
      word: '万彩',
      descriptionHtml: '<p>Theme description</p>',
    });
    expect(result.contactFormUrl).toBe('https://forms.example.com/contact');
    expect(result.announcements).toEqual([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        publishedAt: '2023-01-01',
        attachments: [
          {
            id: '11',
            filenameDownload: 'f1.png',
            type: 'image/png',
            filesize: null,
          },
          {
            id: '12',
            filenameDownload: 'f2.pdf',
            type: 'application/pdf',
            filesize: null,
          },
        ],
      },
    ]);
    expect(result.topics).toEqual([
      {
        id: 2,
        title: 'T1',
        body: 'B2',
        imageId: '21',
        image: {
          id: '21',
          filenameDownload: 'img1.webp',
          type: 'image/webp',
          filesize: null,
        },
      },
    ]);
  });

  it('site_settings が null 値でも既定値へ落とす', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: true,
      value: {
        name: null,
        sns_links: null,
        event_days: null,
        overview_html: null,
        theme_word: null,
        theme_description_html: null,
        contact_form_url: null,
        hero_images: [],
      },
    } as never);
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { docs: [], totalDocs: 0 },
    } as never);

    const result = await getHomePage();

    expect(result.heroImages).toEqual([]);
    expect(result.snsLinks).toEqual([]);
    expect(result.announcements).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.theme).toEqual({ word: null, descriptionHtml: null });
    expect(result.contactFormUrl).toBeNull();
  });

  it('祭情報・テーマ・ヒーロー画像を site_settings の 1 回の取得で得る', async () => {
    await getHomePage();

    expect(cms.findGlobal).toHaveBeenCalledTimes(1);
    expect(cms.findGlobal).toHaveBeenCalledWith('site_settings', { depth: 1 });
  });

  it('announcements は公開済みを新着順に 10 件まで引く', async () => {
    await getHomePage();
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

    const result = await getHomePage();

    expect(result.announcements).toEqual([]);
    expect(result.topics).toEqual([]);
    expect(result.heroImages).toHaveLength(2);
  });

  it('site_settings の取得に失敗しても例外を投げず、設定由来の領域だけが欠落する', async () => {
    vi.mocked(cms.findGlobal).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getHomePage()).resolves.toMatchObject({
      festival: null,
      theme: null,
      heroImages: [],
      snsLinks: [],
      contactFormUrl: null,
    });
    // 設定とは無関係な領域は取得できたとおりに残る
    expect((await getHomePage()).announcements).toHaveLength(1);
  });
});

describe('getHomePage のトピックス取得', () => {
  it('topics は公開済みを公開日時の新しい順に取得する', async () => {
    await getHomePage();
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'topics');
    expect(call?.[1].sort).toEqual(['-published_at']);
    expect((call?.[1].where as PublishedWhere).published_at?.exists).toBe(true);
  });

  it('topics は一覧に要る項目だけを select し depth 1 で取得する', async () => {
    await getHomePage();
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'topics');
    expect(call?.[1].select).toEqual({ title: true, image: true });
    expect(call?.[1].depth).toBe(1);
  });
});
