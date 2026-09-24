import { beforeEach, describe, expect, it, vi } from 'vitest';
import sitemap from './sitemap';
import * as announcementsModule from '@/lib/announcements';
import * as campusMapModule from '@/lib/campus-map';
import * as cmsModule from '@/lib/cms';
import * as exhibitionsModule from '@/lib/exhibitions';
import * as staticPageModule from '@/lib/static-page';
import * as topicsModule from '@/lib/topics';
import { isPublicPath } from '@/lib/phase';

const { SITE_URL } = vi.hoisted(() => ({
  SITE_URL: 'https://aramakisai.com',
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: SITE_URL },
}));

vi.mock('@/lib/crawl-targets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crawl-targets')>(
    '@/lib/crawl-targets',
  );
  return { ...actual, crawlPhase: vi.fn() };
});

vi.mock('@/lib/cms', () => ({ cms: { findGlobal: vi.fn() } }));
vi.mock('@/lib/announcements', () => ({ getAnnouncements: vi.fn() }));
vi.mock('@/lib/topics', () => ({ getTopics: vi.fn() }));
vi.mock('@/lib/exhibitions', () => ({ getExhibitionSitemapEntries: vi.fn() }));
vi.mock('@/lib/campus-map', () => ({ getCampusMapLastModified: vi.fn() }));
vi.mock('@/lib/static-page', () => ({ getPageSlugsUpdatedAt: vi.fn() }));

async function setPhase(phase: 'pre_event' | 'live') {
  const { crawlPhase } = await import('@/lib/crawl-targets');
  vi.mocked(crawlPhase).mockReturnValue(phase);
}

function urlsOf(result: Awaited<ReturnType<typeof sitemap>>): string[] {
  return result.map((entry) => entry.url);
}

beforeEach(() => {
  vi.mocked(cmsModule.cms.findGlobal).mockResolvedValue({
    ok: true,
    // @ts-expect-error テスト用の最小限のフィールドのみ
    value: { updatedAt: '2026-01-01T00:00:00.000Z' },
  });
  vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([]);
  vi.mocked(topicsModule.getTopics).mockResolvedValue([]);
  vi.mocked(exhibitionsModule.getExhibitionSitemapEntries).mockResolvedValue(
    [],
  );
  vi.mocked(campusMapModule.getCampusMapLastModified).mockResolvedValue(null);
  vi.mocked(staticPageModule.getPageSlugsUpdatedAt).mockResolvedValue([]);
});

describe('sitemap (pre_event)', () => {
  beforeEach(async () => {
    await setPhase('pre_event');
  });

  it('トップページを festival_meta.updatedAt で収録する', async () => {
    const result = await sitemap();
    const home = result.find((e) => e.url === `${SITE_URL}/`);

    expect(home?.lastModified).toBe('2026-01-01T00:00:00.000Z');
  });

  it('開催前に公開されるお知らせ一覧・詳細を収録する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([
      {
        id: 1,
        title: 'お知らせ1',
        body: '本文1',
        publishedAt: '2026-07-01',
        attachments: [],
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ]);

    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).toContain(`${SITE_URL}/announcements`);
    expect(urls).toContain(`${SITE_URL}/announcements/1`);
    const list = result.find((e) => e.url === `${SITE_URL}/announcements`);
    expect(list?.lastModified).toBe('2026-07-02T00:00:00.000Z');
  });

  it('開催前は企画・トピック・構内マップを収録しない', async () => {
    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).not.toContain(`${SITE_URL}/exhibitions`);
    expect(urls).not.toContain(`${SITE_URL}/topics`);
    expect(urls).not.toContain(`${SITE_URL}/map`);
    expect(
      exhibitionsModule.getExhibitionSitemapEntries,
    ).not.toHaveBeenCalled();
    expect(topicsModule.getTopics).not.toHaveBeenCalled();
    expect(campusMapModule.getCampusMapLastModified).not.toHaveBeenCalled();
  });

  it('ルート実体の無い /sponsors/* を収録しない', async () => {
    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).not.toContain(`${SITE_URL}/sponsors/ad`);
    expect(urls).not.toContain(`${SITE_URL}/sponsors/local`);
  });

  it('固定ページは実在する slug のみ収録する', async () => {
    vi.mocked(staticPageModule.getPageSlugsUpdatedAt).mockResolvedValue([
      { slug: 'faq', updatedAt: '2026-06-01T00:00:00.000Z' },
    ]);

    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).toContain(`${SITE_URL}/faq`);
    expect(urls).not.toContain(`${SITE_URL}/access`);
  });

  it('お知らせ取得に失敗しても 500 にならず他のエントリで応答する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockRejectedValue(
      new Error('CMS Error'),
    );

    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).not.toContain(`${SITE_URL}/announcements`);
    expect(urls).toContain(`${SITE_URL}/`);
  });

  it('収録した URL はすべて開催前フェーズの公開対象である', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([
      {
        id: 1,
        title: 'お知らせ1',
        body: '本文1',
        publishedAt: '2026-07-01',
        attachments: [],
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ]);
    vi.mocked(staticPageModule.getPageSlugsUpdatedAt).mockResolvedValue([
      { slug: 'faq', updatedAt: '2026-06-01T00:00:00.000Z' },
    ]);

    const result = await sitemap();

    for (const entry of result) {
      const pathname = new URL(entry.url).pathname;
      expect(isPublicPath(pathname, 'pre_event')).toBe(true);
    }
  });
});

describe('sitemap (live)', () => {
  beforeEach(async () => {
    await setPhase('live');
  });

  it('開催中は企画・トピック・構内マップを収録する', async () => {
    vi.mocked(exhibitionsModule.getExhibitionSitemapEntries).mockResolvedValue([
      { id: 1, category: 'stage', updatedAt: '2026-08-01T00:00:00.000Z' },
    ]);
    vi.mocked(topicsModule.getTopics).mockResolvedValue([
      {
        id: 1,
        title: 'トピック1',
        body: '本文',
        imageId: null,
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
    ]);
    vi.mocked(campusMapModule.getCampusMapLastModified).mockResolvedValue(
      '2026-08-03T00:00:00.000Z',
    );

    const result = await sitemap();
    const urls = urlsOf(result);

    expect(urls).toContain(`${SITE_URL}/exhibitions`);
    expect(urls).toContain(`${SITE_URL}/exhibitions/1/stage`);
    expect(urls).toContain(`${SITE_URL}/topics`);
    expect(urls).toContain(`${SITE_URL}/topics/1`);
    const map = result.find((e) => e.url === `${SITE_URL}/map`);
    expect(map?.lastModified).toBe('2026-08-03T00:00:00.000Z');
  });

  it('構内マップの構成コレクションが全滅した場合も lastModified を省いてエントリは残す', async () => {
    vi.mocked(campusMapModule.getCampusMapLastModified).mockResolvedValue(null);

    const result = await sitemap();
    const map = result.find((e) => e.url === `${SITE_URL}/map`);

    expect(map).toBeDefined();
    expect(map?.lastModified).toBeUndefined();
  });
});
