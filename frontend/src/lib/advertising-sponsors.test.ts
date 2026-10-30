import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SponsorListItem } from './sponsors';
import { getSponsors } from './sponsors';
import { cms } from './cms';
import { getPersonalSponsors, groupAdSponsors } from './advertising-sponsors';

vi.mock('./cms', () => ({ cms: { findMany: vi.fn() } }));

describe('getPersonalSponsors', () => {
  afterEach(() => vi.resetAllMocks());
  it('表示順を維持し空白名を除外して ID と表示名だけを返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValueOnce({
      ok: true,
      value: {
        totalDocs: 4,
        docs: [
          {
            id: 9,
            name: ' 花子 ',
            _order: 'a',
            updatedAt: 'x',
            createdAt: 'x',
          },
          { id: 7, name: '　 \t', _order: 'b', updatedAt: 'x', createdAt: 'x' },
          {
            id: 3,
            name: '太郎様',
            _order: 'c',
            updatedAt: 'x',
            createdAt: 'x',
          },
          { id: 1, name: '次郎', _order: 'd', updatedAt: 'x', createdAt: 'x' },
        ],
      },
    } as never);
    expect(await getPersonalSponsors()).toEqual([
      { id: 9, name: '花子' },
      { id: 3, name: '太郎様' },
      { id: 1, name: '次郎' },
    ]);
    expect(cms.findMany).toHaveBeenCalledWith('personal_sponsors', {
      sort: ['_order'],
      limit: 0,
      depth: 0,
    });
  });

  it('登録がないときは空配列を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValueOnce({
      ok: true,
      value: { totalDocs: 0, docs: [] },
    });
    expect(await getPersonalSponsors()).toEqual([]);
    expect(cms.findMany).toHaveBeenCalledWith('personal_sponsors', {
      sort: ['_order'],
      limit: 0,
      depth: 0,
    });
  });

  it('CMS が取得失敗を返す場合は例外として伝播する', async () => {
    vi.mocked(cms.findMany).mockResolvedValueOnce({
      ok: false,
      error: { kind: 'network', status: 503 },
    });
    await expect(getPersonalSponsors()).rejects.toThrow();
  });

  it('CMS が例外を投げた場合も伝播する', async () => {
    const error = new Error('network failure');
    vi.mocked(cms.findMany).mockRejectedValueOnce(error);
    await expect(getPersonalSponsors()).rejects.toThrow(error);
  });
});

function sponsor(overrides: Partial<SponsorListItem> = {}): SponsorListItem {
  return {
    id: 1,
    name: '企業',
    tier: 'planA',
    logoId: '1',
    logoWidth: null,
    logoHeight: null,
    url: null,
    ...overrides,
  };
}

describe('groupAdSponsors', () => {
  it('既存の並びを保ち A〜D に分け、D のロゴは使用しない', () => {
    const groups = groupAdSponsors([
      sponsor({ id: 1, tier: 'planB' }),
      sponsor({ id: 2, tier: 'planA' }),
      sponsor({ id: 3, tier: 'planB' }),
      sponsor({ id: 4, tier: 'planC' }),
      sponsor({ id: 5, tier: 'planD', logoId: '5' }),
      sponsor({ id: 6, tier: 'planA' }),
    ]);
    expect(Object.keys(groups)).toEqual(['planA', 'planB', 'planC', 'planD']);
    expect(groups.planA.map((item) => item.id)).toEqual([2, 6]);
    expect(groups.planB.map((item) => item.id)).toEqual([1, 3]);
    expect(groups.planC.map((item) => item.id)).toEqual([4]);
    expect(groups.planD.map((item) => item.id)).toEqual([5]);
    expect(groups.planD[0].logoId).toBeNull();
  });

  it('不正なプラン、空白名と A〜C のロゴ欠落を除き、ロゴなしの D は残す', () => {
    const groups = groupAdSponsors([
      sponsor({ id: 1, tier: null }),
      sponsor({ id: 2, tier: 'other' }),
      sponsor({ id: 3, name: '　 \t' }),
      sponsor({ id: 4, tier: 'planA', logoId: null }),
      sponsor({ id: 5, tier: 'planB', logoId: null }),
      sponsor({ id: 6, tier: 'planC', logoId: null }),
      sponsor({ id: 7, tier: 'planD', logoId: null }),
      sponsor({ id: 8, tier: 'planA', logoId: '  ' }),
    ]);
    expect(groups).toEqual({
      planA: [],
      planB: [],
      planC: [],
      planD: [{ id: 7, name: '企業', tier: 'planD', logoId: null, url: null }],
    });
  });

  it('既存取得の ad だけを分類し、他種別だけの協賛は掲載しない', async () => {
    vi.mocked(cms.findMany).mockResolvedValueOnce({
      ok: true,
      value: {
        totalDocs: 3,
        docs: [
          { id: 1, type: ['local'], name: '地域', tier: 'planA', logo: 1 },
          {
            id: 2,
            type: ['ad', 'local'],
            name: '兼用',
            tier: 'planA',
            logo: 2,
          },
          { id: 3, type: ['ad'], name: '広告', tier: 'planA', logo: 3 },
        ],
      },
    } as never);
    const result = await getSponsors();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unexpected failure');
    expect(groupAdSponsors(result.value.ad).planA.map(({ id }) => id)).toEqual([
      2, 3,
    ]);
  });

  it('HTTP(S) のみを正規化し、不正 URL は企業を残したまま null にする', () => {
    const values = [
      null,
      '',
      '  ',
      'javascript:alert(1)',
      'ftp://example.test',
      'bad',
      ' https://example.test/path ',
      'http://example.test',
    ];
    const groups = groupAdSponsors(
      values.map((url, id) => sponsor({ id, url })),
    );
    expect(groups.planA.map((item) => item.url)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      'https://example.test/path',
      'http://example.test/',
    ]);
  });

  it('件数を制限せず、空の入力から架空のデータを補わない', () => {
    expect(groupAdSponsors([])).toEqual({
      planA: [],
      planB: [],
      planC: [],
      planD: [],
    });
    const items = Array.from({ length: 150 }, (_, id) => sponsor({ id }));
    expect(groupAdSponsors(items).planA.map(({ id }) => id)).toEqual(
      items.map(({ id }) => id),
    );
  });
});
