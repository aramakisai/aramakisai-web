import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AnnouncementPage from './page';
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

describe('AnnouncementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders announcement correctly when found', async () => {
    // Arrange
    const mockAnnouncement = {
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

    vi.mocked(getAnnouncementById).mockResolvedValue(mockAnnouncement);

    // Act
    const params = Promise.resolve({ id: '1' });
    const jsx = await AnnouncementPage({ params });
    render(jsx);

    // Assert
    expect(getAnnouncementById).toHaveBeenCalledWith(1);
    expect(
      screen.getByRole('heading', { name: 'テストお知らせ', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('2026-07-13T10:00:00Z')).toBeInTheDocument();

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
