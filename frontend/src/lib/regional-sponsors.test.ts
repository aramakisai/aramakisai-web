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
  local_map_category: 'hospital',
  local_latitude: 36.4,
  local_longitude: 139.1,
  local_image: { id: 10 } as Sponsor['local_image'],
  local_image_alt: ' テスト画像 ',
  local_image_decorative: false,
  address: ' 群馬県テスト市 ',
  description: ' 応援メッセージ\n2行目 ',
  local_business_hours: ' 9:00〜17:00 ',
  local_closed_days: ' 日曜日 ',
  local_phone: ' 027-000-0000 ',
  url: ' https://example.invalid/shop ',
  updatedAt: '2026-10-21T00:00:00.000Z',
  createdAt: '2026-10-21T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('toRegionalSponsor', () => {
  it('安全な公開DTOへ変換し、管理項目を含めない', () => {
    expect(toRegionalSponsor(sponsor(), 3)).toEqual({
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
        businessHours: '9:00〜17:00',
        closedDays: '日曜日',
        phone: '027-000-0000',
        websiteUrl: 'https://example.invalid/shop',
        order: 3,
      },
    });
  });

  it('任意値をnullにし、無効URLとアクセシビリティ不成立画像を公開しない', () => {
    const result = toRegionalSponsor(
      sponsor({
        address: ' ',
        description: null,
        local_image_alt: ' ',
        local_image_decorative: false,
        local_business_hours: undefined,
        local_closed_days: null,
        local_phone: '',
        url: 'javascript:alert(1)',
      }),
      0,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        address: null,
        imageId: null,
        imageAlt: null,
        message: null,
        businessHours: null,
        closedDays: null,
        phone: null,
        websiteUrl: null,
      },
    });
  });

  it('altと装飾指定が同時にある不成立画像を公開しない', () => {
    expect(
      toRegionalSponsor(
        sponsor({
          local_image_alt: '同時指定',
          local_image_decorative: true,
        }),
        0,
      ),
    ).toMatchObject({
      ok: true,
      value: {
        imageId: null,
        imageAlt: null,
        imageDecorative: false,
      },
    });
  });

  it('CMSで追加された未知カテゴリも除外せず公開する', () => {
    expect(
      toRegionalSponsor(
        sponsor({ local_map_category: 'future-category' as never }),
        0,
      ),
    ).toMatchObject({
      ok: true,
      value: { category: 'future-category' },
    });
  });

  it.each([
    ['local以外', { type: ['ad'] }],
    ['空名称', { name: ' ' }],
    ['地域タイル提供範囲外', { local_latitude: 36 }],
    ['経度が非有限', { local_longitude: Number.NaN }],
  ])('%sを理由付きで除外する', (_label, overrides) => {
    const result = toRegionalSponsor(sponsor(overrides as Partial<Sponsor>), 0);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe('getRegionalSponsorMapData', () => {
  it('localだけをCMS順・同順位ID順で返し、不成立行だけをログして除外する', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: {
        totalDocs: 4,
        docs: [
          sponsor({ id: 5, _order: 'a1', name: '後' }),
          sponsor({ id: 3, _order: 'a0', name: '同順位後' }),
          sponsor({ id: 2, _order: 'a0', name: '同順位先' }),
          sponsor({ id: 4, _order: 'a2', name: '不成立', local_latitude: 999 }),
        ],
      },
    });

    const result = await getRegionalSponsorMapData();

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('unreachable');
    expect(
      result.sponsors.map(({ id, name, order }) => [id, name, order]),
    ).toEqual([
      [2, '同順位先', 0],
      [3, '同順位後', 1],
      [5, '後', 2],
    ]);
    expect(warn).toHaveBeenCalledWith(
      'regional_sponsor_excluded',
      expect.objectContaining({ id: 4, reasons: expect.any(Array) }),
    );
    expect(cms.findMany).toHaveBeenCalledWith(
      'sponsors',
      { sort: ['_order', 'id'], limit: 0, depth: 0 },
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
