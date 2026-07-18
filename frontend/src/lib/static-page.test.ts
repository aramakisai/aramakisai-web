import { describe, it, expect, vi } from 'vitest';
import { getPageBySlug } from './static-page';
import { directus } from './directus';

vi.mock('./directus', () => ({
  directus: {
    request: vi.fn(),
  },
}));

vi.mock('@directus/sdk', () => ({
  readItems: vi.fn((collection: string, query: unknown) => ({
    type: 'readItems',
    collection,
    query,
  })),
}));

describe('static-page', () => {
  it('maps title, content and embed for a found slug', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        title: 'お問い合わせ',
        content: '<p>Contact</p>',
        embed_url: 'https://forms.example.com',
        embed_height: 900,
      },
    ]);

    const result = await getPageBySlug('contact');
    expect(result).toEqual({
      title: 'お問い合わせ',
      contentHtml: '<p>Contact</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });
  });

  it('falls back to empty string when content is null', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        title: 'お問い合わせ',
        content: null,
        embed_url: null,
        embed_height: null,
      },
    ]);

    const result = await getPageBySlug('contact');
    expect(result?.contentHtml).toBe('');
  });

  it('returns null when slug not found', async () => {
    vi.mocked(directus.request).mockResolvedValue([]);

    const result = await getPageBySlug('unknown');
    expect(result).toBeNull();
  });

  it('returns null when the request throws', async () => {
    vi.mocked(directus.request).mockRejectedValue(new Error('network error'));

    const result = await getPageBySlug('contact');
    expect(result).toBeNull();
  });
});
