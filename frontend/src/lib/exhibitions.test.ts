import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cms } from './cms';
import {
  CATEGORY_LABELS,
  PAGE_SIZE,
  filterExhibitions,
  getExhibitionDetail,
  getExhibitionListData,
  normalizeText,
  paginate,
  parseExhibitionQuery,
  type ExhibitionQuery,
  type ExhibitionSummary,
} from './exhibitions';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const baseQuery: ExhibitionQuery = { q: '', categories: [], areaIds: [], page: 1 };

describe('normalizeText', () => {
  it('全角英数字を半角へ、大文字を小文字へそろえる', () => {
    expect(normalizeText('ＡＢＣ１２３')).toBe('abc123');
  });

  it('半角カナはそのまま (ひらがな/カタカナは吸収しない)', () => {
    expect(normalizeText('ｶﾞｸｾｲ')).toBe('ガクセイ');
  });
});

describe('parseExhibitionQuery', () => {
  it('空の入力は既定値になる', () => {
    expect(parseExhibitionQuery({})).toEqual({
      q: '',
      categories: [],
      areaIds: [],
      page: 1,
    });
  });

  it('q の前後空白を取り除く', () => {
    expect(parseExhibitionQuery({ q: '  祭  ' }).q).toBe('祭');
  });

  it('未知のカテゴリを無視し、既知のカテゴリのみ残す (重複排除)', () => {
    expect(
      parseExhibitionQuery({ category: ['stage', 'unknown', 'stage', 'vendor'] })
        .categories,
    ).toEqual(['stage', 'vendor']);
  });

  it('カンマ区切り単一文字列のカテゴリも解釈する', () => {
    expect(parseExhibitionQuery({ category: 'stage,exhibit' }).categories).toEqual([
      'stage',
      'exhibit',
    ]);
  });

  it('エリア ID は数値へ変換し、不正値と重複を除く', () => {
    expect(
      parseExhibitionQuery({ area: ['1', 'abc', '2', '1', '-3', '0'] }).areaIds,
    ).toEqual([1, 2]);
  });

  it.each(['0', '-1', '1.5', 'abc', undefined])(
    'ページ番号 %s は不正として 1 に落ちる',
    (page) => {
      expect(parseExhibitionQuery({ page }).page).toBe(1);
    },
  );

  it('有効なページ番号はそのまま使う', () => {
    expect(parseExhibitionQuery({ page: '3' }).page).toBe(3);
  });
});

function makeSummary(overrides: Partial<ExhibitionSummary>): ExhibitionSummary {
  return {
    id: 1,
    name: 'テスト企画',
    stageName: 'テスト企画',
    organizationName: 'テスト団体',
    categories: ['exhibit'],
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  };
}

describe('filterExhibitions', () => {
  const items = [
    makeSummary({
      id: 1,
      name: 'ＡＢＣ研究会',
      organizationName: '理工団体',
      categories: ['exhibit'],
      areaIds: [10],
    }),
    makeSummary({
      id: 2,
      name: 'ダンスステージ',
      organizationName: 'abc dance',
      categories: ['stage'],
      areaIds: [20],
    }),
    makeSummary({
      id: 3,
      name: '模擬店',
      organizationName: '料理研究会',
      categories: ['vendor', 'exhibit'],
      areaIds: [10, 30],
    }),
  ];

  it('キーワードは全角/半角・大小文字を無視して企画名または団体名に一致させる', () => {
    expect(filterExhibitions(items, { ...baseQuery, q: 'abc' }).map((i) => i.id)).toEqual([
      1, 2,
    ]);
  });

  it('カテゴリはいずれか一致で絞り込む', () => {
    expect(
      filterExhibitions(items, { ...baseQuery, categories: ['stage', 'vendor'] }).map(
        (i) => i.id,
      ),
    ).toEqual([2, 3]);
  });

  it('エリアはいずれか一致で絞り込む', () => {
    expect(
      filterExhibitions(items, { ...baseQuery, areaIds: [30] }).map((i) => i.id),
    ).toEqual([3]);
  });

  it('複数条件は AND で絞り込む', () => {
    expect(
      filterExhibitions(items, {
        ...baseQuery,
        q: '研究会',
        categories: ['exhibit'],
        areaIds: [10],
      }).map((i) => i.id),
    ).toEqual([1, 3]);
  });

  it('一致しない場合は空配列を返す', () => {
    expect(filterExhibitions(items, { ...baseQuery, q: '存在しない' })).toEqual([]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 5 }, (_, i) => i + 1);

  it('指定ページの範囲を切り出す', () => {
    expect(paginate(items, 1, 2)).toEqual({ items: [1, 2], page: 1, pageCount: 3 });
    expect(paginate(items, 2, 2)).toEqual({ items: [3, 4], page: 2, pageCount: 3 });
  });

  it('範囲外の大きいページ番号は最終ページへ丸める', () => {
    expect(paginate(items, 99, 2)).toEqual({ items: [5], page: 3, pageCount: 3 });
  });

  it('0 以下のページ番号は 1 ページ目へ丸める', () => {
    expect(paginate(items, 0, 2).page).toBe(1);
  });

  it('空配列は 1 ページ目・総ページ数 1 になる', () => {
    expect(paginate([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1 });
  });

  it('既定のページサイズは PAGE_SIZE', () => {
    expect(paginate(items, 1)).toEqual({ items, page: 1, pageCount: 1 });
    expect(PAGE_SIZE).toBe(24);
  });
});

describe('CATEGORY_LABELS', () => {
  it('要件どおりの日本語表示名を持つ', () => {
    expect(CATEGORY_LABELS).toEqual({
      stage: 'ステージ',
      exhibit: '展示',
      vendor: '出店',
      other: 'その他',
    });
  });
});

type MockDocs = {
  exhibitions?: unknown[];
  slots?: unknown[];
  stages?: unknown[];
  areas?: unknown[];
};

function mockCmsCollections({
  exhibitions = [],
  slots = [],
  stages = [],
  areas = [],
}: MockDocs) {
  vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
    const table: Record<string, unknown[]> = {
      student_exhibitions: exhibitions,
      performance_slots: slots,
      stages,
      map_areas: areas,
    };
    const docs = table[collection];
    if (docs === undefined) {
      throw new Error(`unexpected collection: ${collection}`);
    }
    return { ok: true, value: { docs, totalDocs: docs.length } };
  }) as never);
}

describe('getExhibitionListData', () => {
  it('エリアがあればエリア名とブース表示名を組み合わせる', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: 10,
          booth_label: 'A-1',
          images: [],
        },
      ],
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBe('Aゾーン A-1');
    expect(result.items[0]?.areaIds).toEqual([10]);
  });

  it('ブース表示名がなければエリア名のみ', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: 10,
          booth_label: null,
          images: [],
        },
      ],
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBe('Aゾーン');
  });

  it('エリアがなく出演枠のみなら重複を除いたステージ名を連結する', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['stage'],
          area_id: null,
          images: [],
        },
      ],
      slots: [
        { id: 100, stage_id: 1, time_slot_id: 1, exhibition_id: 1 },
        { id: 101, stage_id: 2, time_slot_id: 2, exhibition_id: 1 },
        { id: 102, stage_id: 1, time_slot_id: 3, exhibition_id: 1 },
      ],
      stages: [
        { id: 1, name: 'メインステージ', area_id: 20 },
        { id: 2, name: 'サブステージ', area_id: null },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBe('メインステージ、サブステージ');
    expect(result.items[0]?.areaIds).toEqual([20]);
  });

  it('エリアも出演枠もなければ場所は null', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: null,
          images: [],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBeNull();
    expect(result.items[0]?.areaIds).toEqual([]);
  });

  it('エリアと出演枠の双方があればエリアを優先しつつ areaIds は両方を含む', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['stage', 'exhibit'],
          area_id: 10,
          booth_label: null,
          images: [],
        },
      ],
      slots: [{ id: 100, stage_id: 1, time_slot_id: 1, exhibition_id: 1 }],
      stages: [{ id: 1, name: 'メインステージ', area_id: 20 }],
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBe('Aゾーン');
    expect(result.items[0]?.areaIds).toEqual([10, 20]);
  });

  it('stage_name 未入力なら stageName は name にフォールバックする', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: null,
          stage_name: null,
          images: [],
        },
        {
          id: 2,
          name: '企画B',
          organization_name: '団体B',
          category: ['stage'],
          area_id: null,
          stage_name: '出演名B',
          images: [],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.stageName).toBe('企画A');
    expect(result.items[1]?.stageName).toBe('出演名B');
  });

  it('サムネイルは先頭画像を使い、depth 0 では企画名を alt へ使う', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: null,
          images: [5, 6],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.thumbnail).toEqual({ id: '5', alt: '企画A' });
  });

  it('画像がなければサムネイルは null', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          name: '企画A',
          organization_name: '団体A',
          category: ['exhibit'],
          area_id: null,
          images: [],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.thumbnail).toBeNull();
  });

  it('絞り込み・ページングとファセットを適用して返す', async () => {
    mockCmsCollections({
      exhibitions: Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        name: `企画${i + 1}`,
        organization_name: '団体',
        category: ['exhibit'],
        area_id: null,
        images: [],
      })),
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData({ ...baseQuery, page: 2 });
    expect(result.total).toBe(30);
    expect(result.page).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(result.rangeStart).toBe(25);
    expect(result.rangeEnd).toBe(30);
    expect(result.items).toHaveLength(6);
    expect(result.areas).toEqual([{ id: 10, name: 'Aゾーン' }]);
  });

  it('公開状態を明示的に CMS へ送る', async () => {
    mockCmsCollections({});
    await getExhibitionListData(baseQuery);
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'student_exhibitions');
    expect(call?.[1]?.where).toEqual({ status: { equals: 'published' } });
  });

  it('いずれか 1 本でも取得に失敗したら例外を投げる', async () => {
    vi.mocked(cms.findMany).mockImplementation(async (collection) => {
      if (collection === 'stages') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      return { ok: true, value: { docs: [], totalDocs: 0 } };
    }) as never;

    await expect(getExhibitionListData(baseQuery)).rejects.toThrow();
  });
});

describe('getExhibitionDetail', () => {
  function mockDetail(exhibition: unknown, extra: MockDocs = {}) {
    vi.mocked(cms.findById).mockResolvedValue({ ok: true, value: exhibition } as never);
    mockCmsCollections(extra);
  }

  it('公開済みの企画は found を返し、写真・リンク・紹介文を含む', async () => {
    mockDetail({
      id: 1,
      name: '企画A',
      organization_name: '団体A',
      category: ['exhibit'],
      status: 'published',
      area_id: null,
      description: '紹介文',
      images: [{ id: 5, alt: '写真の説明' }],
      links: [{ platform: 'x', url: 'https://x.com/example' }],
    });

    const result = await getExhibitionDetail(1);
    expect(result).toEqual({
      kind: 'found',
      value: expect.objectContaining({
        id: 1,
        description: '紹介文',
        images: [{ id: '5', alt: '写真の説明' }],
        links: [{ platform: 'x', url: 'https://x.com/example' }],
      }),
    });
  });

  it('見つからない場合は missing を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'not_found' },
    } as never);

    expect(await getExhibitionDetail(999)).toEqual({ kind: 'missing' });
  });

  it('非公開レコードへの参照 (unauthorized) も missing を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'unauthorized' },
    } as never);

    expect(await getExhibitionDetail(1)).toEqual({ kind: 'missing' });
  });

  it('取得できても status が draft なら missing を返す', async () => {
    mockDetail({
      id: 1,
      name: '企画A',
      organization_name: '団体A',
      category: ['exhibit'],
      status: 'draft',
      area_id: null,
      images: [],
    });

    expect(await getExhibitionDetail(1)).toEqual({ kind: 'missing' });
  });

  it('CMS 障害は error を返し、404 にしない', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    expect(await getExhibitionDetail(1)).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
  });

  it('関連データ (ステージ等) の取得失敗も error を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: true,
      value: {
        id: 1,
        name: '企画A',
        organization_name: '団体A',
        category: ['exhibit'],
        status: 'published',
        area_id: null,
        images: [],
      },
    } as never);
    vi.mocked(cms.findMany).mockImplementation(async (collection) => {
      if (collection === 'stages') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      return { ok: true, value: { docs: [], totalDocs: 0 } };
    }) as never;

    const result = await getExhibitionDetail(1);
    expect(result.kind).toBe('error');
  });
});
