import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSponsors } from './sponsors';
import { cms } from './cms';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('getSponsors', () => {
  it('種別の配列がいずれかの値に一致する協賛を各一覧へ振り分ける', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 3,
        docs: [
          {
            id: 1,
            type: ['ad'],
            name: '広告のみ',
            logo: { id: 11, filename: 'ad.webp', mimeType: 'image/webp' },
            url: 'https://ad.example.com',
            tier: 'planA',
          },
          {
            id: 2,
            type: ['local', 'vendor'],
            name: '地域と出店',
            logo: null,
            url: null,
            tier: null,
          },
          {
            id: 3,
            type: ['ad', 'local'],
            name: '広告と地域',
            logo: { id: 13, filename: 'both.webp', mimeType: 'image/webp' },
            url: 'https://both.example.com',
            tier: 'planB',
          },
        ],
      },
    } as never);

    const result = await getSponsors();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.ad.map((s) => s.id)).toEqual([1, 3]);
    expect(result.value.local.map((s) => s.id)).toEqual([2, 3]);
    expect(result.value.vendor.map((s) => s.id)).toEqual([2]);
    expect(result.value.other).toEqual([]);
    expect(result.value.ad[0]).toEqual({
      id: 1,
      name: '広告のみ',
      logoId: '11',
      url: 'https://ad.example.com',
      tier: 'planA',
    });
  });

  it('sort 順で取得し、一覧内の並び順を保つ', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    } as never);

    await getSponsors();

    const [collection, query] = vi.mocked(cms.findMany).mock.calls[0];
    expect(collection).toBe('sponsors');
    expect(query.sort).toEqual(['sort']);
    expect(query.limit).toBe(0);
    expect(query.depth).toBe(1);
  });

  it('0件のときは取得成功のまま空の一覧を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    } as never);

    const result = await getSponsors();

    expect(result).toEqual({
      ok: true,
      value: { ad: [], local: [], vendor: [], other: [] },
    });
  });

  it('取得失敗時は ok: false を返し、0件と区別する', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    const result = await getSponsors();

    expect(result).toEqual({ ok: false });
  });
});
