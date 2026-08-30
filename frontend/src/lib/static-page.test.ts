import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageBySlug } from './static-page';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('static-page', () => {
  it('slug が見つかった場合に title / content / embed を変換する', async () => {
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
          },
        ],
      },
    } as never);

    expect(await getPageBySlug('contact')).toEqual({
      title: 'お問い合わせ',
      contentHtml: '<p>Contact</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });
    expect(cms.findMany).toHaveBeenCalledWith('pages', {
      where: { slug: { equals: 'contact' } },
      limit: 1,
    });
  });

  it('content が null の場合は空文字へ落とす', async () => {
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
          },
        ],
      },
    } as never);

    expect((await getPageBySlug('contact'))?.contentHtml).toBe('');
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
