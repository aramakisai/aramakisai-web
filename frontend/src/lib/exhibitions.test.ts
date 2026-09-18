import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cms } from './cms';
import {
  buildExhibitionsHref,
  CATEGORY_LABELS,
  PAGE_SIZE,
  filterExhibitions,
  getExhibitionDetail,
  getExhibitionListData,
  normalizeText,
  paginate,
  parseExhibitionQuery,
  type ExhibitionCardSummary,
  type ExhibitionQuery,
} from './exhibitions';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const baseQuery: ExhibitionQuery = {
  q: '',
  categories: [],
  areaIds: [],
  page: 1,
};

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
      parseExhibitionQuery({
        category: ['stage', 'unknown', 'stage', 'vendor'],
      }).categories,
    ).toEqual(['stage', 'vendor']);
  });

  it('カンマ区切り単一文字列のカテゴリも解釈する', () => {
    expect(
      parseExhibitionQuery({ category: 'vendor,stage' }).categories,
    ).toEqual(['stage', 'vendor']);
  });

  it('繰り返しキー形式のカテゴリも解釈する (後方互換)', () => {
    expect(
      parseExhibitionQuery({ category: ['vendor', 'stage'] }).categories,
    ).toEqual(['stage', 'vendor']);
  });

  it('カテゴリは定義順 (stage/exhibit/vendor/other) にソートする', () => {
    expect(
      parseExhibitionQuery({ category: 'other,vendor,stage,exhibit' })
        .categories,
    ).toEqual(['stage', 'exhibit', 'vendor', 'other']);
  });

  it('エリア ID は数値へ変換し、不正値と重複を除く', () => {
    expect(
      parseExhibitionQuery({ area: ['1', 'abc', '2', '1', '-3', '0'] }).areaIds,
    ).toEqual([1, 2]);
  });

  it('エリア ID はカンマ区切りでも解釈し、数値昇順にソートする', () => {
    expect(parseExhibitionQuery({ area: '7,5,6' }).areaIds).toEqual([5, 6, 7]);
  });

  it('繰り返しキー形式のエリア ID も解釈する (後方互換)', () => {
    expect(parseExhibitionQuery({ area: ['7', '6', '5'] }).areaIds).toEqual([
      5, 6, 7,
    ]);
  });

  it('選択順が違っても解釈結果 (categories/areaIds) は同じになる', () => {
    const a = parseExhibitionQuery({
      category: 'vendor,stage',
      area: '7,5,6',
    });
    const b = parseExhibitionQuery({
      category: 'stage,vendor',
      area: '5,6,7',
    });
    expect(a.categories).toEqual(b.categories);
    expect(a.areaIds).toEqual(b.areaIds);
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

describe('buildExhibitionsHref', () => {
  it('カテゴリをカンマ区切り・定義順で連結する', () => {
    expect(
      buildExhibitionsHref({
        q: '',
        categories: ['vendor', 'stage'],
        areaIds: [],
      }),
    ).toBe('/exhibitions?category=stage,vendor');
  });

  it('エリア ID をカンマ区切り・数値昇順で連結する', () => {
    expect(
      buildExhibitionsHref({ q: '', categories: [], areaIds: [7, 6, 5] }),
    ).toBe('/exhibitions?area=5,6,7');
  });

  it('選択順が違っても同じ URL になる', () => {
    const a = buildExhibitionsHref({
      q: '',
      categories: ['stage', 'vendor'],
      areaIds: [7, 6, 5],
    });
    const b = buildExhibitionsHref({
      q: '',
      categories: ['vendor', 'stage'],
      areaIds: [5, 6, 7],
    });
    expect(a).toBe(b);
    expect(a).toBe('/exhibitions?category=stage,vendor&area=5,6,7');
  });

  it('q は含め、page は 1 以下なら含めない', () => {
    expect(
      buildExhibitionsHref({ q: '祭', categories: [], areaIds: [], page: 1 }),
    ).toBe('/exhibitions?q=%E7%A5%AD');
    expect(
      buildExhibitionsHref({ q: '', categories: [], areaIds: [], page: 2 }),
    ).toBe('/exhibitions?page=2');
  });

  it('値が空のパラメータは URL に出さない', () => {
    expect(buildExhibitionsHref({ q: '', categories: [], areaIds: [] })).toBe(
      '/exhibitions',
    );
  });
});

function makeCard(
  overrides: Partial<ExhibitionCardSummary>,
): ExhibitionCardSummary {
  return {
    id: 1,
    category: 'exhibit',
    displayName: 'テスト企画',
    organizationName: 'テスト団体',
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  };
}

describe('filterExhibitions', () => {
  const items = [
    makeCard({
      id: 1,
      displayName: 'ＡＢＣ研究会',
      organizationName: '理工団体',
      category: 'exhibit',
      areaIds: [10],
    }),
    makeCard({
      id: 2,
      displayName: 'ダンスステージ',
      organizationName: 'abc dance',
      category: 'stage',
      areaIds: [20],
    }),
    makeCard({
      id: 3,
      displayName: '模擬店',
      organizationName: '料理研究会',
      category: 'vendor',
      areaIds: [10, 30],
    }),
    makeCard({
      id: 3,
      displayName: '模擬店',
      organizationName: '料理研究会',
      category: 'exhibit',
      areaIds: [10, 30],
    }),
  ];

  it('キーワードは全角/半角・大小文字を無視して企画名または団体名に一致させる', () => {
    expect(
      filterExhibitions(items, { ...baseQuery, q: 'abc' }).map(
        (i) => `${i.id}:${i.category}`,
      ),
    ).toEqual(['1:exhibit', '2:stage']);
  });

  it('カテゴリはカード自身のカテゴリがいずれか一致で絞り込む', () => {
    expect(
      filterExhibitions(items, {
        ...baseQuery,
        categories: ['stage', 'vendor'],
      }).map((i) => `${i.id}:${i.category}`),
    ).toEqual(['2:stage', '3:vendor']);
  });

  it('エリアはいずれか一致で絞り込む', () => {
    expect(
      filterExhibitions(items, { ...baseQuery, areaIds: [30] }).map(
        (i) => `${i.id}:${i.category}`,
      ),
    ).toEqual(['3:vendor', '3:exhibit']);
  });

  it('複数条件は AND で絞り込む', () => {
    expect(
      filterExhibitions(items, {
        ...baseQuery,
        q: '研究会',
        categories: ['exhibit'],
        areaIds: [10],
      }).map((i) => `${i.id}:${i.category}`),
    ).toEqual(['1:exhibit', '3:exhibit']);
  });

  it('一致しない場合は空配列を返す', () => {
    expect(filterExhibitions(items, { ...baseQuery, q: '存在しない' })).toEqual(
      [],
    );
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 5 }, (_, i) => i + 1);

  it('指定ページの範囲を切り出す', () => {
    expect(paginate(items, 1, 2)).toEqual({
      items: [1, 2],
      page: 1,
      pageCount: 3,
    });
    expect(paginate(items, 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      pageCount: 3,
    });
  });

  it('範囲外の大きいページ番号は最終ページへ丸める', () => {
    expect(paginate(items, 99, 2)).toEqual({
      items: [5],
      page: 3,
      pageCount: 3,
    });
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
  it('entries の行ごとに企画カードへ分割し、ID 昇順 × entries 登録順で並べる', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体1',
          area_id: null,
          entries: [
            { id: 'e1', category: 'vendor', name: '企画1-出店', images: [] },
            { id: 'e2', category: 'stage', name: '企画1-出演', images: [] },
          ],
        },
        {
          id: 2,
          organization_name: '団体2',
          area_id: null,
          entries: [
            { id: 'e3', category: 'other', name: '企画2', images: [] },
          ],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    // CATEGORY_VALUES の定義順 (stage < vendor) では並べ替えず、entries の登録順 (vendor → stage) を保つ
    expect(result.items.map((i) => `${i.id}:${i.category}`)).toEqual([
      '1:vendor',
      '1:stage',
      '2:other',
    ]);
    expect(result.total).toBe(3);
  });

  it('ステージのカードは出演ステージ名のみを場所にし、エリアがあっても無視する', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: 10,
          booth_label: 'A-1',
          entries: [
            { id: 'e1', category: 'stage', name: '企画A-出演', images: [] },
          ],
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
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBe('メインステージ、サブステージ');
    // areaIds は場所解決の対象外でも直接エリア + ステージ由来エリアの和を保つ
    expect(result.items[0]?.areaIds).toEqual([10, 20]);
  });

  it('ステージ以外のカードはエリア名 (+ブース表示名) のみを場所にし、出演枠があっても無視する', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: 10,
          booth_label: 'A-1',
          entries: [
            { id: 'e1', category: 'stage', name: '企画A-出演', images: [] },
            { id: 'e2', category: 'exhibit', name: '企画A-展示', images: [] },
          ],
        },
      ],
      slots: [{ id: 100, stage_id: 1, time_slot_id: 1, exhibition_id: 1 }],
      stages: [{ id: 1, name: 'メインステージ', area_id: 20 }],
      areas: [{ id: 10, name: 'Aゾーン' }],
    });

    const result = await getExhibitionListData(baseQuery);
    const exhibitCard = result.items.find((i) => i.category === 'exhibit');
    expect(exhibitCard?.location).toBe('Aゾーン A-1');
  });

  it('ブース表示名がなければエリア名のみ', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: 10,
          booth_label: null,
          entries: [
            { id: 'e1', category: 'exhibit', name: '企画A', images: [] },
          ],
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
          organization_name: '団体A',
          area_id: null,
          entries: [
            { id: 'e1', category: 'stage', name: '企画A-出演', images: [] },
          ],
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
          organization_name: '団体A',
          area_id: null,
          entries: [
            { id: 'e1', category: 'exhibit', name: '企画A', images: [] },
          ],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items[0]?.location).toBeNull();
    expect(result.items[0]?.areaIds).toEqual([]);
  });

  it('カードの企画名はそのエントリーの企画名から直接得る (フォールバックなし)', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: null,
          entries: [
            { id: 'e1', category: 'stage', name: '出演名A', images: [] },
            { id: 'e2', category: 'exhibit', name: '展示名A', images: [] },
          ],
        },
      ],
    });

    const result = await getExhibitionListData(baseQuery);
    expect(result.items.map((i) => i.displayName)).toEqual([
      '出演名A',
      '展示名A',
    ]);
  });

  it('サムネイルは先頭画像を使い、エントリーの企画名を alt へ使う', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: null,
          entries: [
            { id: 'e1', category: 'exhibit', name: '企画A', images: [5, 6] },
          ],
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
          organization_name: '団体A',
          area_id: null,
          entries: [
            { id: 'e1', category: 'exhibit', name: '企画A', images: [] },
          ],
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
        organization_name: '団体',
        area_id: null,
        entries: [
          { id: 'e1', category: 'exhibit', name: `企画${i + 1}`, images: [] },
        ],
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
    vi.mocked(cms.findById).mockResolvedValue({
      ok: true,
      value: exhibition,
    } as never);
    mockCmsCollections(extra);
  }

  it('公開済みの企画は found を返し、URL の category 文脈で写真・リンク・紹介文・全カテゴリを含む', async () => {
    mockDetail({
      id: 1,
      organization_name: '団体A',
      status: 'published',
      area_id: null,
      entries: [
        {
          id: 'e1',
          category: 'exhibit',
          name: '企画A',
          description: '紹介文',
          images: [{ id: 5, alt: '写真の説明' }],
        },
        { id: 'e2', category: 'vendor', name: '企画A-出店', images: [] },
      ],
      links: [{ platform: 'x', url: 'https://x.com/example' }],
    });

    const result = await getExhibitionDetail(1, 'exhibit');
    expect(result).toEqual({
      kind: 'found',
      value: expect.objectContaining({
        id: 1,
        category: 'exhibit',
        displayName: '企画A',
        categories: ['exhibit', 'vendor'],
        description: '紹介文',
        images: [{ id: '5', alt: '写真の説明' }],
        links: [{ platform: 'x', url: 'https://x.com/example' }],
      }),
    });
    expect(result.kind === 'found' && 'name' in result.value).toBe(false);
  });

  it('カテゴリごとにそのエントリーの企画名を返す (フォールバックなし)', async () => {
    mockDetail({
      id: 1,
      organization_name: '団体A',
      status: 'published',
      area_id: null,
      entries: [
        { id: 'e1', category: 'stage', name: '出演名A', images: [] },
        { id: 'e2', category: 'exhibit', name: '展示名A', images: [] },
      ],
    });

    expect(await getExhibitionDetail(1, 'stage')).toMatchObject({
      kind: 'found',
      value: { displayName: '出演名A' },
    });
    expect(await getExhibitionDetail(1, 'exhibit')).toMatchObject({
      kind: 'found',
      value: { displayName: '展示名A' },
    });
  });

  it('その企画が持たない category を指定すると missing を返す', async () => {
    mockDetail({
      id: 1,
      organization_name: '団体A',
      status: 'published',
      area_id: null,
      entries: [{ id: 'e1', category: 'exhibit', name: '企画A', images: [] }],
    });

    expect(await getExhibitionDetail(1, 'stage')).toEqual({ kind: 'missing' });
  });

  it('見つからない場合は missing を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'not_found' },
    } as never);

    expect(await getExhibitionDetail(999, 'exhibit')).toEqual({
      kind: 'missing',
    });
  });

  it('非公開レコードへの参照 (unauthorized) も missing を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'unauthorized' },
    } as never);

    expect(await getExhibitionDetail(1, 'exhibit')).toEqual({
      kind: 'missing',
    });
  });

  it('取得できても status が draft なら missing を返す', async () => {
    mockDetail({
      id: 1,
      organization_name: '団体A',
      status: 'draft',
      area_id: null,
      entries: [{ id: 'e1', category: 'exhibit', name: '企画A', images: [] }],
    });

    expect(await getExhibitionDetail(1, 'exhibit')).toEqual({
      kind: 'missing',
    });
  });

  it('CMS 障害は error を返し、404 にしない', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    expect(await getExhibitionDetail(1, 'exhibit')).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
  });

  it('関連データ (ステージ等) の取得失敗も error を返す', async () => {
    vi.mocked(cms.findById).mockResolvedValue({
      ok: true,
      value: {
        id: 1,
        organization_name: '団体A',
        status: 'published',
        area_id: null,
        entries: [
          { id: 'e1', category: 'exhibit', name: '企画A', images: [] },
        ],
      },
    } as never);
    vi.mocked(cms.findMany).mockImplementation(async (collection) => {
      if (collection === 'stages') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      return { ok: true, value: { docs: [], totalDocs: 0 } };
    }) as never;

    const result = await getExhibitionDetail(1, 'exhibit');
    expect(result.kind).toBe('error');
  });
});
