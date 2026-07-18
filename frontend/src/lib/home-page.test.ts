import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHomePage } from './home-page';
import { directus } from './directus';
import { readItems } from '@directus/sdk';

vi.mock('./directus', () => ({
  directus: {
    request: vi.fn(),
  },
}));

vi.mock('@directus/sdk', () => ({
  readSingleton: vi.fn((collection: string, query?: unknown) => ({
    type: 'readSingleton',
    collection,
    query,
  })),
  readItems: vi.fn((collection: string, query?: unknown) => ({
    type: 'readItems',
    collection,
    query,
  })),
}));

describe('getHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          name: '荒牧祭',
          sns_links: [{ platform: 'twitter', url: 'https://twitter.com' }],
          event_days: [{ label: '1日目', open: '09:00', close: '17:00' }],
          overview: '<p>Overview</p>',
          hero_image: 'meta_hero1',
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home'
      ) {
        return {
          hero_message: '<p>Hello</p>',
          hero_images: [
            {
              sort: 2,
              directus_files_id: {
                id: 'hero2',
                filename_download: 'hero2.jpg',
                type: 'image/jpeg',
              },
            },
            {
              sort: 1,
              directus_files_id: {
                id: 'hero1',
                filename_download: 'hero1.jpg',
                type: 'image/jpeg',
              },
            },
          ],
        };
      }
      if (
        request.type === 'readItems' &&
        request.collection === 'announcements'
      ) {
        return [
          {
            id: 1,
            title: 'A1',
            body: 'B1',
            published_at: '2023-01-01',
            attachments: [
              {
                sort: 2,
                directus_files_id: {
                  id: 'file2',
                  filename_download: 'f2.pdf',
                  type: 'application/pdf',
                },
              },
              {
                sort: 1,
                directus_files_id: {
                  id: 'file1',
                  filename_download: 'f1.png',
                  type: 'image/png',
                },
              },
            ],
          },
        ];
      }
      if (request.type === 'readItems' && request.collection === 'topics') {
        return [
          {
            id: 2,
            title: 'T1',
            body: 'B2',
            image: 'img1',
            attachments: [
              {
                sort: 1,
                directus_files_id: {
                  id: 'file3',
                  filename_download: 'f3.pdf',
                  type: 'application/pdf',
                },
              },
            ],
          },
        ];
      }
      if (request.type === 'readItems' && request.collection === 'sponsors') {
        return [
          {
            id: 3,
            type: 'sponsor',
            name: 'S1',
            logo: 'logo1',
            url: 'https://sponsor.example.com',
            tier: null,
          },
        ];
      }
      return null;
    });
  });

  it('returns home page content with sorted hero images', async () => {
    const result = await getHomePage();

    expect(result.heroMessageHtml).toBe('<p>Hello</p>');
    expect(result.heroImages).toEqual([
      { id: 'hero1', filenameDownload: 'hero1.jpg', type: 'image/jpeg' },
      { id: 'hero2', filenameDownload: 'hero2.jpg', type: 'image/jpeg' },
    ]);
    expect(result.snsLinks).toEqual([
      { platform: 'twitter', url: 'https://twitter.com' },
    ]);
    expect(result.festival).toEqual({
      name: '荒牧祭',
      eventDays: [{ label: '1日目', open: '09:00', close: '17:00' }],
      overviewHtml: '<p>Overview</p>',
      heroImageId: 'meta_hero1',
    });
    expect(result.announcements).toEqual([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        publishedAt: '2023-01-01',
        attachments: [
          { id: 'file1', filenameDownload: 'f1.png', type: 'image/png' },
          { id: 'file2', filenameDownload: 'f2.pdf', type: 'application/pdf' },
        ],
      },
    ]);
    expect(result.sponsors).toEqual([
      {
        id: 3,
        type: 'sponsor',
        name: 'S1',
        logoId: 'logo1',
        url: 'https://sponsor.example.com',
        tier: null,
      },
    ]);
    expect(result.topics).toEqual([
      {
        id: 2,
        title: 'T1',
        body: 'B2',
        imageId: 'img1',
        attachments: [
          { id: 'file3', filenameDownload: 'f3.pdf', type: 'application/pdf' },
        ],
      },
    ]);
  });

  it('falls back to empty values when festival_meta and page_home fields are null', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          name: null,
          sns_links: null,
          event_days: null,
          overview: null,
          hero_image: null,
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home'
      ) {
        return { hero_message: null, hero_images: [] };
      }
      return [];
    });

    const result = await getHomePage();

    expect(result.heroMessageHtml).toBe('');
    expect(result.heroImages).toEqual([]);
    expect(result.snsLinks).toEqual([]);
    expect(result.announcements).toEqual([]);
    expect(result.topics).toEqual([]);
  });

  it('uses correct query for announcements', async () => {
    await getHomePage();
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
      limit: 10,
    });
  });

  it('uses correct query for topics', async () => {
    await getHomePage();
    expect(readItems).toHaveBeenCalledWith('topics', {
      fields: [
        '*',
        'attachments.sort',
        'attachments.directus_files_id.id',
        'attachments.directus_files_id.filename_download',
        'attachments.directus_files_id.type',
      ],
      sort: ['sort'],
    });
  });
});
