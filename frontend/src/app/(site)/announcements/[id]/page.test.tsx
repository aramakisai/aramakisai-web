import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnnouncementPage, { generateMetadata } from './page';
import { notFound } from 'next/navigation';
import { getAnnouncementById } from '@/lib/announcements';

// Mock dependencies
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/announcements', () => ({
  getAnnouncementById: vi.fn(),
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://aramakisai.example.com' },
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

const baseAnnouncement = {
  id: 1,
  title: 'テストお知らせ',
  body: '<p>これはテストです</p><img src="https://example.com/assets/42" alt="添付画像" data-media-id="42">',
  publishedAt: '2026-07-13T10:00:00Z',
  attachments: [
    {
      id: 'file-1',
      filenameDownload: 'test.pdf',
      type: 'application/pdf',
      filesize: 1782579,
    },
  ],
  metaDescription: null,
  ogImageId: null,
};

describe('AnnouncementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders announcement correctly when found', async () => {
    // Arrange
    vi.mocked(getAnnouncementById).mockResolvedValue(baseAnnouncement);

    // Act
    const params = Promise.resolve({ id: '1' });
    const jsx = await AnnouncementPage({ params });
    render(jsx);

    // Assert
    expect(getAnnouncementById).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole('heading', { name: 'テストお知らせ', level: 1 }),
    ).toBeInTheDocument();
    // 公開日時は「2026年7月13日」表記 (要件 16.4) で、生の ISO 文字列のままにはしない
    expect(screen.getByText('2026年7月13日')).toBeInTheDocument();

    // 戻る導線 (要件 16.2)
    const backLink = screen.getByRole('link', {
      name: 'お知らせ一覧に戻る',
    });
    expect(backLink).toHaveAttribute('href', '/announcements');

    // RichText content is rendered
    expect(screen.getByText('これはテストです')).toBeInTheDocument();

    // 本文中の画像は RichTextImageViewer によって拡大用ボタンで包まれる
    const imageButton = screen.getByRole('button', {
      name: '画像を拡大: 添付画像',
    });
    expect(
      imageButton.querySelector('img[data-media-id="42"]'),
    ).toBeInTheDocument();

    // Attachment check
    expect(
      screen.getByRole('heading', { name: '添付ファイル', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('パンくず (トップ › お知らせ › タイトル) の BreadcrumbList JSON-LD を出力する (要件 5.7)', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue(baseAnnouncement);

    const params = Promise.resolve({ id: '1' });
    const { container } = render(await AnnouncementPage({ params }));

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(
      data.itemListElement.map((item: { name: string }) => item.name),
    ).toEqual(['トップ', 'お知らせ', 'テストお知らせ']);
    expect(data.itemListElement[2].item).toBe(
      'https://aramakisai.example.com/announcements/1',
    );
  });

  it('does not render the attachment heading when there are no attachments', async () => {
    // Arrange (要件 16.8: 添付が 0 件のときは見出しごと出さない)
    vi.mocked(getAnnouncementById).mockResolvedValue({
      ...baseAnnouncement,
      attachments: [],
    });

    // Act
    const params = Promise.resolve({ id: '1' });
    const jsx = await AnnouncementPage({ params });
    render(jsx);

    // Assert
    expect(
      screen.queryByRole('heading', { name: '添付ファイル', level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('calls notFound when announcement does not exist', async () => {
    // Arrange
    vi.mocked(getAnnouncementById).mockResolvedValue(null);

    // Act & Assert
    const params = Promise.resolve({ id: '999' });
    await expect(AnnouncementPage({ params })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(getAnnouncementById).toHaveBeenCalledWith(999);
    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when id is invalid', async () => {
    // Act & Assert
    const params = Promise.resolve({ id: 'invalid' });
    await expect(AnnouncementPage({ params })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );

    // Assert
    expect(notFound).toHaveBeenCalled();
    expect(getAnnouncementById).not.toHaveBeenCalled();
  });
});

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the announcement title as the page title (要件 16.10)', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue(baseAnnouncement);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '1' }),
    });

    expect(metadata.title).toBe('テストお知らせ');
    expect(metadata.description).toBe('これはテストです');
    expect(metadata.alternates).toEqual({ canonical: '/announcements/1' });
    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      title: 'テストお知らせ',
      description: 'これはテストです',
    });
  });

  it('ページ固有の meta description が優先される (要件 6.9)', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue({
      ...baseAnnouncement,
      metaDescription: '編集者が設定した説明文',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '1' }),
    });

    expect(metadata.description).toBe('編集者が設定した説明文');
  });

  it('OG 画像は announcement.ogImageId を採用する', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue({
      ...baseAnnouncement,
      ogImageId: '99',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '1' }),
    });

    expect(metadata.openGraph?.images).toEqual([
      { url: 'https://example.com/assets/99' },
    ]);
  });

  it('サイト既定値へ退避する (取得結果なし、要件 2.10 / 8.1)', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '999' }),
    });

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(metadata.description).toBe('荒牧祭公式サイト');
    expect(metadata.openGraph).toBeDefined();
  });

  it('サイト既定値へ退避する (id 不正、取得しない)', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(metadata.title).toEqual({ absolute: '荒牧祭' });
    expect(getAnnouncementById).not.toHaveBeenCalled();
  });
});
