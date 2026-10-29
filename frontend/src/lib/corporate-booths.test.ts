import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapArea, Sponsor } from '@/cms-types';
import { cms } from './cms';
import {
  getCorporateBoothCards,
  getCorporateBoothDetail,
  getCorporateBoothSitemapEntries,
  isCorporateBooth,
} from './corporate-booths';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const findMany = vi.mocked(cms.findMany);
const findById = vi.mocked(cms.findById);

function sponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 1,
    type: ['vendor'],
    name: '株式会社テスト',
    url: 'https://example.com',
    description: '応援メッセージ',
    logo: 99,
    vendor: {
      name: 'たこ焼き',
      description: '紹介文',
      images: [10, 11],
      open_days: ['2026-11-07T00:00:00+09:00'],
      area_id: 5,
      booth_number: '3',
      booth_label: 'A',
    },
    updatedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const area = { id: 5, name: 'Aゾーン' } as MapArea;

function ok<T>(value: T) {
  return { ok: true as const, value };
}

describe('isCorporateBooth', () => {
  it('出店協賛で企画名があれば真', () => {
    expect(isCorporateBooth(sponsor())).toBe(true);
  });
  it('種別に出店協賛が無ければ偽', () => {
    expect(isCorporateBooth(sponsor({ type: ['ad'] }))).toBe(false);
  });
  it('vendor が無い・企画名が空白のみなら偽', () => {
    expect(isCorporateBooth(sponsor({ vendor: undefined }))).toBe(false);
    expect(isCorporateBooth(sponsor({ vendor: { name: '  　' } }))).toBe(false);
    expect(isCorporateBooth(sponsor({ vendor: { name: null } }))).toBe(false);
  });
});

describe('getCorporateBoothCards', () => {
  it('掲載対象だけをカードへ変換する', async () => {
    findMany.mockImplementation((async (slug: string) =>
      slug === 'sponsors'
        ? ok({
            docs: [
              sponsor(),
              sponsor({ id: 2, type: ['ad', 'vendor'], vendor: { name: ' ' } }),
              sponsor({ id: 3, type: ['local'] }),
            ],
            totalDocs: 3,
          })
        : ok({ docs: [area], totalDocs: 1 })) as never);

    const cards = await getCorporateBoothCards();

    expect(cards).toEqual([
      {
        id: 1,
        category: 'booth',
        displayName: 'たこ焼き',
        organizationName: '株式会社テスト',
        location: 'Aゾーン A 3',
        areaIds: [5],
        thumbnail: { id: '10', alt: 'たこ焼き' },
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      'sponsors',
      expect.objectContaining({ sort: ['_order'], limit: 0, depth: 0 }),
    );
  });

  it('エリア未設定・画像なしは location null・areaIds 空・thumbnail null', async () => {
    findMany.mockImplementation((async (slug: string) =>
      slug === 'sponsors'
        ? ok({
            docs: [sponsor({ vendor: { name: 'x', images: [] } })],
            totalDocs: 1,
          })
        : ok({ docs: [area], totalDocs: 1 })) as never);
    const [card] = await getCorporateBoothCards();
    expect(card).toMatchObject({
      location: null,
      areaIds: [],
      thumbnail: null,
    });
  });

  it('取得失敗は例外', async () => {
    findMany.mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);
    await expect(getCorporateBoothCards()).rejects.toThrow();
  });
});

describe('getCorporateBoothDetail', () => {
  it('整数でない ID は取得せず missing', async () => {
    expect(await getCorporateBoothDetail('abc')).toEqual({ kind: 'missing' });
    expect(await getCorporateBoothDetail('1.5')).toEqual({ kind: 'missing' });
    expect(findById).not.toHaveBeenCalled();
  });

  it('not_found・非掲載対象は missing', async () => {
    findById.mockResolvedValueOnce({
      ok: false,
      error: { kind: 'not_found' },
    } as never);
    expect(await getCorporateBoothDetail('1')).toEqual({ kind: 'missing' });

    findById.mockResolvedValueOnce(ok(sponsor({ type: ['ad'] })) as never);
    expect(await getCorporateBoothDetail('1')).toEqual({ kind: 'missing' });
  });

  it('通信失敗は error', async () => {
    const error = { kind: 'network', status: 502 } as const;
    findById.mockResolvedValue({ ok: false, error } as never);
    expect(await getCorporateBoothDetail('1')).toEqual({
      kind: 'error',
      error,
    });
  });

  it('エリア取得失敗は error', async () => {
    const error = { kind: 'network', status: 500 } as const;
    findById.mockResolvedValue(ok(sponsor()) as never);
    findMany.mockResolvedValue({ ok: false, error } as never);
    expect(await getCorporateBoothDetail('1')).toEqual({
      kind: 'error',
      error,
    });
  });

  it('詳細へ変換する (リンク・出店日・全画像・カテゴリ)', async () => {
    findById.mockResolvedValue(ok(sponsor()) as never);
    findMany.mockResolvedValue(ok({ docs: [area], totalDocs: 1 }) as never);

    const result = await getCorporateBoothDetail('1');

    expect(result).toEqual({
      kind: 'found',
      value: {
        id: 1,
        category: 'booth',
        displayName: 'たこ焼き',
        organizationName: '株式会社テスト',
        location: 'Aゾーン A 3',
        areaIds: [5],
        thumbnail: { id: '10', alt: 'たこ焼き' },
        description: '紹介文',
        images: [
          { id: '10', alt: 'たこ焼き' },
          { id: '11', alt: 'たこ焼き' },
        ],
        links: [{ platform: 'website', url: 'https://example.com' }],
        categories: ['booth'],
        openDayKeys: ['2026-11-07'],
      },
    });
    expect(result).not.toHaveProperty('value.menu');
  });

  it('URL が無ければ links は空、不正な出店日は除く', async () => {
    findById.mockResolvedValue(
      ok(
        sponsor({
          url: null,
          vendor: { name: 'x', open_days: ['invalid'] },
        }),
      ) as never,
    );
    findMany.mockResolvedValue(ok({ docs: [], totalDocs: 0 }) as never);
    const result = await getCorporateBoothDetail('1');
    expect(result).toMatchObject({
      kind: 'found',
      value: { links: [], openDayKeys: [], description: null, images: [] },
    });
  });
});

describe('getCorporateBoothSitemapEntries', () => {
  it('掲載対象の ID と更新日時を返す', async () => {
    findMany.mockResolvedValue(
      ok({
        docs: [sponsor(), sponsor({ id: 2, vendor: { name: '' } })],
        totalDocs: 2,
      }) as never,
    );
    expect(await getCorporateBoothSitemapEntries()).toEqual([
      { id: 1, updatedAt: '2026-10-01T00:00:00.000Z' },
    ]);
  });

  it('取得失敗は例外', async () => {
    findMany.mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);
    await expect(getCorporateBoothSitemapEntries()).rejects.toThrow();
  });
});
