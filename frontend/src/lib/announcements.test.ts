import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnnouncements, getAnnouncementById } from './announcements';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

type PublishedWhere = {
  published_at?: { exists?: boolean; less_than_equal?: string };
};

beforeEach(() => vi.clearAllMocks());

describe('getAnnouncements', () => {
  it('公開済みのお知らせを新着順に全件取得する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 2,
        docs: [
          {
            id: 1,
            title: 'A1',
            body_html: 'B1',
            published_at: '2023-01-01',
            attachments: [
              { id: 1, filename: 'file1.jpg', mimeType: 'image/jpeg' },
              { id: 2, filename: 'file2.pdf', mimeType: 'application/pdf' },
            ],
            meta_description: '説明文A1',
            og_image: { id: 9, filename: 'og1.webp', mimeType: 'image/webp' },
            updatedAt: '2023-01-02T00:00:00.000Z',
          },
          {
            id: 2,
            title: 'A2',
            body_html: null,
            published_at: '2023-02-01',
            attachments: null,
            meta_description: null,
            og_image: null,
            updatedAt: '2023-02-02T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const result = await getAnnouncements();

    expect(result).toEqual([
      {
        id: 1,
        title: 'A1',
        body: 'B1',
        publishedAt: '2023-01-01',
        attachments: [
          {
            id: '1',
            filenameDownload: 'file1.jpg',
            type: 'image/jpeg',
            filesize: null,
          },
          {
            id: '2',
            filenameDownload: 'file2.pdf',
            type: 'application/pdf',
            filesize: null,
          },
        ],
        metaDescription: '説明文A1',
        ogImageId: '9',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
      {
        id: 2,
        title: 'A2',
        body: '',
        publishedAt: '2023-02-01',
        attachments: [],
        metaDescription: null,
        ogImageId: null,
        updatedAt: '2023-02-02T00:00:00.000Z',
      },
    ]);

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('announcements');
    expect(query.sort).toEqual(['-published_at']);
    expect(query.limit).toBe(0);
    expect(query.depth).toBe(1);
    const where = query.where as PublishedWhere;
    expect(where.published_at?.exists).toBe(true);
    expect(where.published_at?.less_than_equal).toBeTypeOf('string');
  });

  it('取得に失敗した場合は例外を投げる', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getAnnouncements()).rejects.toThrow();
  });
});

describe('getAnnouncementById', () => {
  it('IDでお知らせを1件取得する (一覧と同じ公開済み条件を id 一致と組み合わせる)', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 1,
        docs: [
          {
            id: 10,
            title: 'A10',
            body_html: 'B10',
            published_at: '2023-10-01',
            attachments: [],
            meta_description: null,
            og_image: null,
            updatedAt: '2023-10-02T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const result = await getAnnouncementById(10);

    expect(result).toEqual({
      id: 10,
      title: 'A10',
      body: 'B10',
      publishedAt: '2023-10-01',
      attachments: [],
      metaDescription: null,
      ogImageId: null,
      updatedAt: '2023-10-02T00:00:00.000Z',
    });

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('announcements');
    expect(query.limit).toBe(1);
    expect(query.depth).toBe(1);
    const where = query.where as PublishedWhere & { id?: { equals?: number } };
    expect(where.id?.equals).toBe(10);
    expect(where.published_at?.exists).toBe(true);
    expect(where.published_at?.less_than_equal).toBeTypeOf('string');
  });

  it('未公開・不在・取得失敗はいずれも null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    } as never);
    expect(await getAnnouncementById(999)).toBeNull();

    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);
    expect(await getAnnouncementById(10)).toBeNull();
  });
});
