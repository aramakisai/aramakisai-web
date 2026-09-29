import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFaqItems } from './faq';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getFaqItems', () => {
  it('faq_items を表示順 (sort) 昇順・全件・関連展開なしで取得し、順序を保って整形する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 2,
        docs: [
          {
            id: 1,
            question: '質問1',
            answer: '回答1',
            sort: 1,
            updatedAt: '2026-01-02T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 2,
            question: '質問2',
            answer: '回答2',
            sort: null,
            updatedAt: '2026-01-03T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const result = await getFaqItems();

    expect(result).toEqual([
      {
        id: 1,
        question: '質問1',
        answer: '回答1',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 2,
        question: '質問2',
        answer: '回答2',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
    ]);

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('faq_items');
    expect(query.sort).toEqual(['sort']);
    expect(query.limit).toBe(0);
    expect(query.depth).toBe(0);
  });

  it('取得に失敗した場合は例外を投げる', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    await expect(getFaqItems()).rejects.toThrow();
  });
});
