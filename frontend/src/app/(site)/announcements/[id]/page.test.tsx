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

    expect(metadata).toEqual({ title: 'テストお知らせ' });
  });

  it('returns empty metadata when the announcement does not exist', async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '999' }),
    });

    expect(metadata).toEqual({});
  });

  it('returns empty metadata for an invalid id without fetching', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'invalid' }),
    });

    expect(metadata).toEqual({});
    expect(getAnnouncementById).not.toHaveBeenCalled();
  });
});
