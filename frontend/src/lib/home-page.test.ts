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
          home_active_variant: 'pre_event',
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
          hero_image: 'hero1',
          hero_message: '<p>Hello</p>',
          embed_url: 'https://youtube.com',
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home_live'
      ) {
        return {
          hero_image: 'hero2',
          hero_message: '<p>Live</p>',
          embed_url: 'https://youtube.com/live',
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

  it('returns live variant when overrideVariant param is live', async () => {
    const result = await getHomePage('live');
    expect(result.variant).toBe('live');
    expect(result.content.heroMessageHtml).toBe('<p>Live</p>');
    if (result.variant === 'live') {
      expect(result.content.topics).toEqual([
        {
          id: 2,
          title: 'T1',
          body: 'B2',
          imageId: 'img1',
          attachments: [
            {
              id: 'file3',
              filenameDownload: 'f3.pdf',
              type: 'application/pdf',
            },
          ],
        },
      ]);
    }
  });

  it('returns pre_event variant when home_active_variant is pre_event', async () => {
    const result = await getHomePage();
    expect(result.variant).toBe('pre_event');
    if (result.variant === 'pre_event') {
      expect(result.content.heroMessageHtml).toBe('<p>Hello</p>');
      expect(result.content.snsLinks).toEqual([
        { platform: 'twitter', url: 'https://twitter.com' },
      ]);
      expect(result.content.announcements).toEqual([
        {
          id: 1,
          title: 'A1',
          body: 'B1',
          publishedAt: '2023-01-01',
          attachments: [
            { id: 'file1', filenameDownload: 'f1.png', type: 'image/png' },
            {
              id: 'file2',
              filenameDownload: 'f2.pdf',
              type: 'application/pdf',
            },
          ],
        },
      ]);
      expect(result.content.festival).toEqual({
        name: '荒牧祭',
        eventDays: [{ label: '1日目', open: '09:00', close: '17:00' }],
        overviewHtml: '<p>Overview</p>',
        heroImageId: 'meta_hero1',
      });
      expect(result.content.sponsors).toEqual([
        {
          id: 3,
          type: 'sponsor',
          name: 'S1',
          logoId: 'logo1',
          url: 'https://sponsor.example.com',
          tier: null,
        },
      ]);
    }
  });

  it('returns live variant when home_active_variant is live', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          home_active_variant: 'live',
          sns_links: [],
          overview: null,
          hero_image: null,
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home_live'
      ) {
        return { hero_image: 'hero2', hero_message: null, embed_url: null };
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
            attachments: [],
          },
        ];
      }
      return [];
    });

    const result = await getHomePage();
    expect(result.variant).toBe('live');
    if (result.variant === 'live') {
      expect(result.content.heroMessageHtml).toBe('');
      expect(result.content.snsLinks).toEqual([]);
      expect(result.content.announcements).toEqual([
        {
          id: 1,
          title: 'A1',
          body: 'B1',
          publishedAt: '2023-01-01',
          attachments: [],
        },
      ]);
      expect(result.content.topics).toEqual([]);
    }
  });

  it('fallbacks to pre_event when home_active_variant is null', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          home_active_variant: null,
          sns_links: null,
          overview: null,
          hero_image: null,
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home'
      ) {
        return { hero_image: null, hero_message: null, embed_url: null };
      }
      return [];
    });

    const result = await getHomePage();
    expect(result.variant).toBe('pre_event');
    expect(result.content.snsLinks).toEqual([]);
  });

  it('fallbacks to pre_event when home_active_variant is invalid string', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          home_active_variant: 'foo',
          sns_links: [],
          overview: null,
          hero_image: null,
        };
      }
      if (
        request.type === 'readSingleton' &&
        request.collection === 'page_home'
      ) {
        return { hero_image: null, hero_message: null, embed_url: null };
      }
      return [];
    });

    const result = await getHomePage();
    expect(result.variant).toBe('pre_event');
  });

  it('uses correct query for announcements during pre_event', async () => {
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

  it('does not query topics during pre_event', async () => {
    await getHomePage();
    expect(readItems).not.toHaveBeenCalledWith('topics', expect.anything());
  });

  it('uses correct query for topics during live', async () => {
    await getHomePage('live');
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
