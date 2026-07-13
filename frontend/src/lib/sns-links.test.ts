import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSnsLinks } from './sns-links';
import { directus } from './directus';

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

describe('getSnsLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sns_links successfully', async () => {
    const mockLinks = [{ platform: 'twitter', url: 'https://twitter.com' }];
    vi.mocked(directus.request).mockResolvedValueOnce({
      sns_links: mockLinks,
    });

    const result = await getSnsLinks();
    expect(result).toEqual(mockLinks);
  });

  it('returns empty array if sns_links is null', async () => {
    vi.mocked(directus.request).mockResolvedValueOnce({
      sns_links: null,
    });

    const result = await getSnsLinks();
    expect(result).toEqual([]);
  });

  it('returns empty array if meta is null', async () => {
    vi.mocked(directus.request).mockResolvedValueOnce(null);

    const result = await getSnsLinks();
    expect(result).toEqual([]);
  });

  it('returns empty array when directus is unreachable (throws exception)', async () => {
    vi.mocked(directus.request).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await getSnsLinks();
    expect(result).toEqual([]);
  });
});
