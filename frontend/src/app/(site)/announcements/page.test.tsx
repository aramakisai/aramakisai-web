import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AnnouncementsPage, { generateMetadata } from './page';
import * as announcementsModule from '@/lib/announcements';
import * as siteMetadataModule from '@/lib/site-metadata';
import type { AnnouncementSummary } from '@/lib/home-page-types';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/announcements', () => ({
  getAnnouncements: vi.fn(),
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

// paginate の import 元 (@/lib/exhibitions) が @/lib/cms 経由で @/env を検証するため、
// exhibitions/page.test.tsx と同様にモックする
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

function announcement(
  overrides: Partial<AnnouncementSummary>,
): AnnouncementSummary {
  return {
    id: 1,
    title: 'お知らせ',
    body: '本文',
    publishedAt: '2026-07-01',
    attachments: [],
    ...overrides,
  };
}

function announcements(count: number): AnnouncementSummary[] {
  return Array.from({ length: count }, (_, i) =>
    announcement({ id: i + 1, title: `お知らせ${i + 1}` }),
  );
}

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return render(
    await AnnouncementsPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    vi.mocked(announcementsModule.getAnnouncements).mockReset();
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
      SITE_METADATA,
    );
  });

  it('見出し「お知らせ」を h1 で表示する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue(
      announcements(1),
    );

    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'お知らせ' }),
    ).toBeInTheDocument();
  });

  it('11 件以上あるとき 1 ページ目に 10 件だけ表示し、ページ送りを出す', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue(
      announcements(11),
    );

    await renderPage();

    expect(screen.getByText('お知らせ1')).toBeInTheDocument();
    expect(screen.getByText('お知らせ10')).toBeInTheDocument();
    expect(screen.queryByText('お知らせ11')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      '/announcements?page=2',
    );
  });

  it('2 ページ目 (?page=2) は 11 件目以降を表示する', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue(
      announcements(11),
    );

    await renderPage({ page: '2' });

    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
    expect(screen.queryByText('お知らせ1')).not.toBeInTheDocument();
  });

  it('範囲外のページ番号は有効なページへ丸める', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue(
      announcements(11),
    );

    await renderPage({ page: '999' });

    // 全 2 ページ中、最後のページ (2 ページ目) の内容に丸められる
    expect(screen.getByText('お知らせ11')).toBeInTheDocument();
  });

  it('10 件以下のときはページ送りを表示しない', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue(
      announcements(10),
    );

    await renderPage();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('0 件のとき「お知らせはありません」を表示し、ページ送りは出さない', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('取得エラー時はクラッシュせず見出しのみ表示', async () => {
    vi.mocked(announcementsModule.getAnnouncements).mockRejectedValue(
      new Error('Directus Error'),
    );

    await renderPage();

    expect(
      screen.getByRole('heading', { name: 'お知らせ' }),
    ).toBeInTheDocument();
  });
});

describe('generateMetadata (要件2.2, 2.9)', () => {
  it('title / description を持ち、ページ番号を含まない canonical を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('お知らせ');
    expect(metadata.description).toMatch(/お知らせ/);
    expect(metadata.alternates).toEqual({ canonical: '/announcements' });
  });
});
