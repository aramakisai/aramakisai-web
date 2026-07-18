import { describe, it, expect, vi } from 'vitest';
import { getAnnouncements, getAnnouncementById } from './announcements';
import { directus } from './directus';
import { readItems, readItem } from '@directus/sdk';

vi.mock('./directus', () => ({
  directus: {
    request: vi.fn(),
  },
}));

vi.mock('@directus/sdk', () => ({
  readItems: vi.fn((collection: string, query?: unknown) => ({
    type: 'readItems',
    collection,
    query,
  })),
  readItem: vi.fn(
    (collection: string, id: string | number, query?: unknown) => ({
      type: 'readItem',
      collection,
      id,
      query,
    }),
  ),
}));

describe('getAnnouncements', () => {
  it('公開済みのお知らせを新着順に全件取得する', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        published_at: '2023-01-01',
        attachments: [
          {
            sort: 2,
            directus_files_id: {
              id: 'f2',
              filename_download: 'file2.pdf',
              type: 'application/pdf',
            },
          },
          {
            sort: 1,
            directus_files_id: {
              id: 'f1',
              filename_download: 'file1.jpg',
              type: 'image/jpeg',
            },
          },
        ],
      },
      {
        id: 2,
        title: 'A2',
        body: null,
        published_at: '2023-02-01',
        attachments: null,
      },
    ]);

    const result = await getAnnouncements();

    expect(result).toEqual([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        publishedAt: '2023-01-01',
        attachments: [
          { id: 'f1', filenameDownload: 'file1.jpg', type: 'image/jpeg' },
          { id: 'f2', filenameDownload: 'file2.pdf', type: 'application/pdf' },
        ],
      },
      {
        id: 2,
        title: 'A2',
        body: '',
        publishedAt: '2023-02-01',
        attachments: [],
      },
    ]);
    expect(readItems).toHaveBeenCalledWith('announcements', {
      fields: [
        '*',
        'attachments.sort',
        'attachments.directus_files_id.id',
        'attachments.directus_files_id.filename_download',
        'attachments.directus_files_id.type',
      ],
      filter: { published_at: { _lte: '$NOW', _nnull: true } },
      sort: ['-published_at'],
      limit: -1,
    });
  });
});

describe('getAnnouncementById', () => {
  it('IDでお知らせを1件取得する', async () => {
    vi.mocked(directus.request).mockResolvedValue({
      id: 10,
      title: 'A10',
      body: 'B10',
      published_at: '2023-10-01',
      attachments: [],
    });

    const result = await getAnnouncementById(10);

    expect(result).toEqual({
      id: 10,
      title: 'A10',
      body: 'B10',
      publishedAt: '2023-10-01',
      attachments: [],
    });

    expect(readItem).toHaveBeenCalledWith('announcements', 10, {
      fields: [
        '*',
        'attachments.sort',
        'attachments.directus_files_id.id',
        'attachments.directus_files_id.filename_download',
        'attachments.directus_files_id.type',
      ],
    });
  });

  it('存在しない場合はnullを返す', async () => {
    vi.mocked(directus.request).mockRejectedValue(new Error('Not found'));

    const result = await getAnnouncementById(999);

    expect(result).toBeNull();
  });
});
