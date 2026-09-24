import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageBySlug, getPageSlugsUpdatedAt } from './static-page';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('static-page', () => {
  it('slug が見つかった場合に title / content / embed / SEO フィールドを変換する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 1,
        docs: [
          {
            id: 1,
            slug: 'contact',
            title: 'お問い合わせ',
            content_html: '<p>Contact</p>',
            embed_url: 'https://forms.example.com',
            embed_height: 900,
            meta_description: 'お問い合わせの説明文',
            og_image: { id: 3, filename: 'og.webp', mimeType: 'image/webp' },
            updatedAt: '2023-05-01T00:00:00.000Z',
          },
        ],
      },
    } as never);

    expect(await getPageBySlug('contact')).toEqual({
      title: 'お問い合わせ',
      contentHtml: '<p>Contact</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
      metaDescription: 'お問い合わせの説明文',
      ogImageId: '3',
      updatedAt: '2023-05-01T00:00:00.000Z',
    });
    expect(cms.findMany).toHaveBeenCalledWith('pages', {
      where: { slug: { equals: 'contact' } },
      limit: 1,
    });
  });

  it('content / meta_description / og_image が null の場合は空文字・null へ落とす', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 1,
        docs: [
          {
            id: 1,
            slug: 'contact',
            title: 'お問い合わせ',
            content_html: null,
            embed_url: null,
            embed_height: null,
            meta_description: null,
            og_image: null,
            updatedAt: '2023-05-01T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const page = await getPageBySlug('contact');
    expect(page?.contentHtml).toBe('');
    expect(page?.metaDescription).toBeNull();
    expect(page?.ogImageId).toBeNull();
  });

  it('slug が見つからない場合は null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    } as never);

    expect(await getPageBySlug('unknown')).toBeNull();
  });

  it('取得に失敗した場合は null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 0 },
    } as never);

    expect(await getPageBySlug('contact')).toBeNull();
  });
});

describe('getPageSlugsUpdatedAt', () => {
  it('pages に実在する slug の更新日時のみを返す (sitemap は実在しないページを載せない)', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 2,
        docs: [
          { id: 1, slug: 'contact', updatedAt: '2023-05-01T00:00:00.000Z' },
          { id: 2, slug: 'faq', updatedAt: '2023-05-02T00:00:00.000Z' },
        ],
      },
    } as never);

    const result = await getPageSlugsUpdatedAt(['contact', 'faq', 'unknown']);

    expect(result).toEqual([
      { slug: 'contact', updatedAt: '2023-05-01T00:00:00.000Z' },
      { slug: 'faq', updatedAt: '2023-05-02T00:00:00.000Z' },
    ]);
    expect(cms.findMany).toHaveBeenCalledWith('pages', {
      where: { slug: { in: ['contact', 'faq', 'unknown'] } },
      limit: 0,
      depth: 0,
    });
  });

  it('slug を渡さない場合は取得せず空配列を返す', async () => {
    expect(await getPageSlugsUpdatedAt([])).toEqual([]);
    expect(cms.findMany).not.toHaveBeenCalled();
  });

  it('取得に失敗した場合は空配列を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    expect(await getPageSlugsUpdatedAt(['contact'])).toEqual([]);
  });
});
