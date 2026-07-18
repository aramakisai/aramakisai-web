import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFestivalMeta } from './festival-meta';
import { directus } from './directus';
import { readSingleton } from '@directus/sdk';

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
}));

describe('getFestivalMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches festival_meta and returns formatted FestivalOverview', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          name: '荒牧祭',
          event_days: [{ label: '1日目', open: '09:00', close: '17:00' }],
          overview: '<p>概要</p>',
          hero_image: 'hero123',
        };
      }
      return null;
    });

    const result = await getFestivalMeta();

    expect(readSingleton).toHaveBeenCalledWith('festival_meta', {
      fields: ['name', 'event_days', 'overview', 'hero_image'],
    });

    expect(result).toEqual({
      name: '荒牧祭',
      eventDays: [{ label: '1日目', open: '09:00', close: '17:00' }],
      overviewHtml: '<p>概要</p>',
      heroImageId: 'hero123',
    });
  });

  it('handles null values for event_days, overview, and hero_image', async () => {
    vi.mocked(directus.request).mockImplementation(async (req: unknown) => {
      const request = req as { type?: string; collection?: string };
      if (
        request.type === 'readSingleton' &&
        request.collection === 'festival_meta'
      ) {
        return {
          name: null,
          event_days: null,
          overview: null,
          hero_image: null,
        };
      }
      return null;
    });

    const result = await getFestivalMeta();

    expect(result).toEqual({
      name: '',
      eventDays: [],
      overviewHtml: null,
      heroImageId: null,
    });
  });
});
