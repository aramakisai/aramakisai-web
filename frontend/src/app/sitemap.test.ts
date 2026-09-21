import { describe, expect, it, vi } from 'vitest';
import sitemap from './sitemap';
import * as announcementsModule from '@/lib/announcements';
import { isPublicPath, PRE_EVENT_PUBLIC_PATHS } from '@/lib/phase';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://aramakisai.com',
  },
}));

vi.mock('@/lib/announcements', () => ({
  getAnnouncements: vi.fn(),
}));

describe('sitemap', () => {
  it('公開対象一覧の各パスを収録する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([]);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    for (const path of PRE_EVENT_PUBLIC_PATHS) {
      expect(urls).toContain(
        new URL(path, 'https://aramakisai.com').toString(),
      );
    }
  });

  it('お知らせ詳細の URL を収録する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([
      {
        id: 1,
        title: 'お知らせ1',
        body: '本文1',
        publishedAt: '2026-07-01',
        attachments: [],
      },
    ]);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toContain('https://aramakisai.com/announcements/1');
  });

  it('お知らせ取得に失敗した場合は固定パスのみを返す', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockRejectedValue(
      new Error('CMS Error'),
    );

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).toEqual(
      PRE_EVENT_PUBLIC_PATHS.map((path) =>
        new URL(path, 'https://aramakisai.com').toString(),
      ),
    );
  });

  it('収録した URL はすべて開催前フェーズの公開対象である', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([
      {
        id: 1,
        title: 'お知らせ1',
        body: '本文1',
        publishedAt: '2026-07-01',
        attachments: [],
      },
    ]);

    const result = await sitemap();

    for (const entry of result) {
      const pathname = new URL(entry.url).pathname;
      expect(isPublicPath(pathname, 'pre_event')).toBe(true);
    }
  });

  it('開催中フェーズでのみ公開されるページは収録しない', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([]);

    const result = await sitemap();
    const urls = result.map((entry) => entry.url);

    expect(urls).not.toContain('https://aramakisai.com/topics');
    expect(urls).not.toContain('https://aramakisai.com/exhibitions');
    expect(urls).not.toContain('https://aramakisai.com/map');
  });
});
