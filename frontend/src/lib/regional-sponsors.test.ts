import type { Sponsor } from '@/cms-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cms } from './cms';
import {
  getRegionalSponsorMapData,
  toRegionalSponsor,
} from './regional-sponsors';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn() },
}));

const sponsor = (overrides: Partial<Sponsor> = {}): Sponsor => ({
  id: 1,
  _order: 'a0',
  type: ['local'],
  name: ' テスト専用地域協賛 ',
  business_category: 'hospital',
  local_latitude: 36.4,
  local_longitude: 139.1,
  local_image: { id: 10, alt: ' テスト画像 ' } as Sponsor['local_image'],
  address: ' 群馬県テスト市 ',
  description: ' 応援メッセージ\n2行目 ',
  local_business_hours: ' 9:00〜17:00\n日曜定休 ',
  local_phone: ' 027-000-0000 ',
  url: ' https://example.invalid/shop ',
  updatedAt: '2026-10-21T00:00:00.000Z',
  createdAt: '2026-10-21T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('toRegionalSponsor', () => {
  it('安全な公開DTOへ変換し、管理項目を含めない', () => {
    expect(toRegionalSponsor(sponsor())).toEqual({
      ok: true,
      value: {
        id: 1,
        name: 'テスト専用地域協賛',
        category: 'hospital',
        latitude: 36.4,
        longitude: 139.1,
        address: '群馬県テスト市',
        imageId: '10',
        imageAlt: 'テスト画像',
        imageDecorative: false,
        message: '応援メッセージ\n2行目',
        businessHours: '9:00〜17:00\n日曜定休',
        phone: '027-000-0000',
        websiteUrl: 'https://example.invalid/shop',
      },
    });
  });

  it('任意値をnullにし、無効URLを公開せず、altが空の画像は装飾扱いにする', () => {
    const result = toRegionalSponsor(
      sponsor({
        address: ' ',
        description: null,
        local_image: { id: 10, alt: ' ' } as Sponsor['local_image'],
        local_business_hours: undefined,
        local_phone: '',
        url: 'javascript:alert(1)',
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        address: null,
        imageId: '10',
        imageAlt: null,
        imageDecorative: true,
        message: null,
        businessHours: null,
        phone: null,
        websiteUrl: null,
      },
    });
  });

  it.each([
    ['local以外', { type: ['ad'] }],
    ['空名称', { name: ' ' }],
    ['未知カテゴリ', { business_category: 'future-category' as never }],
    ['カテゴリ未設定', { business_category: null }],
    ['地域タイル提供範囲外', { local_latitude: 36 }],
    ['経度が非有限', { local_longitude: Number.NaN }],
  ])('%sを理由付きで除外する', (_label, overrides) => {
    const result = toRegionalSponsor(sponsor(overrides as Partial<Sponsor>));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('getRegionalSponsorMapData', () => {
  it('CMSの並びのまま返し、不成立行だけをログして除外する', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 4,
        docs: [
          sponsor({ id: 5, name: '先' }),
          sponsor({ id: 3, name: '中' }),
          sponsor({ id: 4, name: '不成立', local_latitude: 999 }),
          sponsor({ id: 2, name: '後' }),
        ],
      },
    });

    const result = await getRegionalSponsorMapData();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('unreachable');
    expect(result.sponsors.map(({ id, name }) => [id, name])).toEqual([
      [5, '先'],
      [3, '中'],
      [2, '後'],
    ]);
    expect(warn).toHaveBeenCalledWith(
      'regional_sponsor_excluded',
      expect.objectContaining({ id: 4, reasons: expect.any(Array) }),
    );
    expect(cms.findMany).toHaveBeenCalledWith(
      'sponsors',
      expect.objectContaining({
        where: { type: { equals: 'local' } },
        select: expect.objectContaining({ local_latitude: true, type: true }),
        sort: ['_order', 'id'],
        limit: 0,
        depth: 1,
      }),
      undefined,
    );
    warn.mockRestore();
  });

  it('0件を成功として返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    });
    await expect(getRegionalSponsorMapData()).resolves.toEqual({
      ok: true,
      sponsors: [],
    });
  });

  it('CMS取得失敗をunavailableとして返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 503 },
    });
    await expect(getRegionalSponsorMapData()).resolves.toEqual({
      ok: false,
      error: 'unavailable',
    });
  });
});
