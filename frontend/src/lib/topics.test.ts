import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTopics, getTopicById } from './topics';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

type PublishedWhere = { published_at?: { exists?: boolean } };

beforeEach(() => vi.clearAllMocks());

describe('getTopics', () => {
  it('公開済みのトピックを sort 順に取得する', async () => {
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
            attachments: [
              { id: 11, filename: 'test1.pdf', mimeType: 'application/pdf' },
              { id: 12, filename: 'test2.pdf', mimeType: 'application/pdf' },
            ],
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
        attachments: [
          { id: '11', filenameDownload: 'test1.pdf', type: 'application/pdf' },
          { id: '12', filenameDownload: 'test2.pdf', type: 'application/pdf' },
        ],
      },
    ]);

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('topics');
    expect(query.sort).toEqual(['sort']);
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
  it('IDでトピックを1件取得する', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: true,
      value: {
        id: 1,
        title: 'Topic 1',
        body_html: 'Body 1',
        image: 7,
        attachments: [
          { id: 11, filename: 'test1.pdf', mimeType: 'application/pdf' },
        ],
      },
    } as never);

    const result = await getTopicById(1);

    expect(result).toEqual({
      id: 1,
      title: 'Topic 1',
      body: 'Body 1',
      imageId: '7',
      attachments: [
        { id: '11', filenameDownload: 'test1.pdf', type: 'application/pdf' },
      ],
    });
    expect(cms.findById).toHaveBeenCalledWith('topics', 1, { depth: 1 });
  });

  it('存在しない場合はnullを返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'not_found' },
    } as never);

    expect(await getTopicById(999)).toBeNull();
  });
});
