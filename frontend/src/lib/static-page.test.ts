import { describe, it, expect, vi } from 'vitest';
import { getContactPage, getAccessPage, getPrivacyPage } from './static-page';
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
  it('getContactPage maps content and form_embed_url', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        content: '<p>Contact</p>',
        form_embed_url: 'https://forms.example.com',
      },
    ]);

    const result = await getContactPage();
    expect(result).toEqual({
      contentHtml: '<p>Contact</p>',
      embedUrl: 'https://forms.example.com',
    });
  });

  it('getAccessPage maps content and map_embed_url', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      { content: '<p>Access</p>', map_embed_url: 'https://maps.example.com' },
    ]);

    const result = await getAccessPage();
    expect(result).toEqual({
      contentHtml: '<p>Access</p>',
      embedUrl: 'https://maps.example.com',
    });
  });

  it('getPrivacyPage maps content with no embed', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      { content: '<p>Privacy</p>' },
    ]);

    const result = await getPrivacyPage();
    expect(result).toEqual({
      contentHtml: '<p>Privacy</p>',
      embedUrl: null,
    });
  });

  it('falls back to empty string when content is null', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      { content: null, form_embed_url: null },
    ]);

    const result = await getContactPage();
    expect(result.contentHtml).toBe('');
  });

  it('throws when page slug not found', async () => {
    vi.mocked(directus.request).mockResolvedValue([]);

    await expect(getContactPage()).rejects.toThrow('page not found: contact');
  });
});
