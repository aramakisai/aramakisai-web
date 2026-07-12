import { describe, it, expect, vi } from 'vitest';
import { getAnnouncements } from './announcements';
import { directus } from './directus';
import { readItems } from '@directus/sdk';

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
}));

describe('getAnnouncements', () => {
  it('公開済みのお知らせを新着順に全件取得する', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      { id: 1, title: 'A1', body: 'B1', published_at: '2023-01-01' },
      { id: 2, title: 'A2', body: null, published_at: '2023-02-01' },
    ]);

    const result = await getAnnouncements();

    expect(result).toEqual([
      { id: 1, title: 'A1', body: 'B1', publishedAt: '2023-01-01' },
      { id: 2, title: 'A2', body: '', publishedAt: '2023-02-01' },
    ]);
    expect(readItems).toHaveBeenCalledWith('announcements', {
      filter: { published_at: { _lte: '$NOW', _nnull: true } },
      sort: ['-published_at'],
      limit: -1,
    });
  });
});
