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
  it('getContactPage maps title, content and embed', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        title: 'お問い合わせ',
        content: '<p>Contact</p>',
        embed_url: 'https://forms.example.com',
        embed_height: 900,
      },
    ]);

    const result = await getContactPage();
    expect(result).toEqual({
      title: 'お問い合わせ',
      contentHtml: '<p>Contact</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });
  });

  it('getAccessPage maps title, content and embed', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        title: 'アクセス',
        content: '<p>Access</p>',
        embed_url: 'https://maps.example.com',
        embed_height: null,
      },
    ]);

    const result = await getAccessPage();
    expect(result).toEqual({
      title: 'アクセス',
      contentHtml: '<p>Access</p>',
      embedUrl: 'https://maps.example.com',
      embedHeight: null,
    });
  });

  it('getPrivacyPage maps title and content with no embed', async () => {
    vi.mocked(directus.request).mockResolvedValue([
      {
        title: 'プライバシーポリシー',
        content: '<p>Privacy</p>',
        embed_url: null,
        embed_height: null,
      },
    ]);

    const result = await getPrivacyPage();
    expect(result).toEqual({
      title: 'プライバシーポリシー',
      contentHtml: '<p>Privacy</p>',
      embedUrl: null,
      embedHeight: null,
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

    const result = await getContactPage();
    expect(result.contentHtml).toBe('');
  });

  it('throws when page slug not found', async () => {
    vi.mocked(directus.request).mockResolvedValue([]);

    await expect(getContactPage()).rejects.toThrow('page not found: contact');
  });
});
