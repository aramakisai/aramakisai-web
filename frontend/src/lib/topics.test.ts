import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTopics, getTopicById } from './topics';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

type PublishedWhere = { published_at?: { exists?: boolean } };

beforeEach(() => vi.clearAllMocks());

describe('getTopics', () => {
  it('公開済みのトピックを公開日時の新しい順に取得する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 1,
        docs: [
          {
            id: 1,
            title: 'Topic 1',
            body_html: 'Body 1',
            image: { id: 7, filename: 'img1.webp', mimeType: 'image/webp' },
            meta_description: '説明文1',
            updatedAt: '2023-01-02T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const result = await getTopics();

    expect(result).toEqual([
      {
        id: 1,
        title: 'Topic 1',
        body: 'Body 1',
        imageId: '7',
        metaDescription: '説明文1',
        updatedAt: '2023-01-02T00:00:00.000Z',
      },
    ]);

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('topics');
    expect(query.sort).toEqual(['-published_at']);
    expect(query.depth).toBe(1);
    expect((query.where as PublishedWhere).published_at?.exists).toBe(true);
  });

  it('取得に失敗した場合は例外を投げる', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getTopics()).rejects.toThrow();
  });
});

describe('getTopicById', () => {
  it('IDでトピックを1件取得する (一覧と同じ公開済み条件を id 一致と組み合わせる)', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 1,
        docs: [
          {
            id: 1,
            title: 'Topic 1',
            body_html: 'Body 1',
            image: 7,
            meta_description: null,
            updatedAt: '2023-01-02T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const result = await getTopicById(1);

    expect(result).toEqual({
      id: 1,
      title: 'Topic 1',
      body: 'Body 1',
      imageId: '7',
      metaDescription: null,
      updatedAt: '2023-01-02T00:00:00.000Z',
    });

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('topics');
    expect(query.limit).toBe(1);
    expect(query.depth).toBe(1);
    const where = query.where as PublishedWhere & { id?: { equals?: number } };
    expect(where.id?.equals).toBe(1);
    expect(where.published_at?.exists).toBe(true);
  });

  it('未公開・不在・取得失敗はいずれも null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    } as never);
    expect(await getTopicById(999)).toBeNull();

    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);
    expect(await getTopicById(1)).toBeNull();
  });
});
