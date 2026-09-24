import { beforeEach, describe, expect, it, vi } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { cms } from './cms';
import {
  buildCampusMapHref,
  getCampusMapAreas,
  getCampusMapData,
  getCampusMapLastModified,
  parseCampusMapQuery,
  resolveAreaColor,
} from './campus-map';

// campus-map.ts は exhibitions.ts 経由で cms.ts (env.ts の起動時検証を含む) に依存するため、
// exhibitions.test.ts と同様にモックしてユニットテストの対象外にする。
vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('parseCampusMapQuery', () => {
  it('空の入力は既定値になる', () => {
    expect(parseCampusMapQuery({})).toEqual({
      q: '',
      categories: [],
      selectedAreaId: null,
    });
  });

  it('複数のエリアが指定された場合は最小の ID を選択中として扱う', () => {
    expect(parseCampusMapQuery({ area: ['7', '3', '5'] }).selectedAreaId).toBe(
      3,
    );
  });

  it('URL 上の出現順ではなく最小 ID を選ぶ', () => {
    expect(parseCampusMapQuery({ area: '9,2' }).selectedAreaId).toBe(2);
  });

  it('キーワードとカテゴリも解釈する', () => {
    const filters = parseCampusMapQuery({
      q: '祭',
      category: 'vendor,stage',
    });
    expect(filters.q).toBe('祭');
    expect(filters.categories).toEqual(['stage', 'vendor']);
  });
});

describe('buildCampusMapHref', () => {
  it('企画一覧と同じ正規化 (カテゴリの定義順・カンマ区切り) で /map の URL を組み立てる', () => {
    expect(
      buildCampusMapHref({
        q: '',
        categories: ['vendor', 'stage'],
        selectedAreaId: null,
      }),
    ).toBe('/map?category=stage,vendor');
  });

  it('選択中エリアをクエリに含める', () => {
    expect(
      buildCampusMapHref({ q: '', categories: [], selectedAreaId: 5 }),
    ).toBe('/map?area=5');
  });

  it('条件が空なら /map のみになる', () => {
    expect(
      buildCampusMapHref({ q: '', categories: [], selectedAreaId: null }),
    ).toBe('/map');
  });

  it('parseCampusMapQuery とラウンドトリップし、複数エリアのクエリからは最小 ID の URL に正規化される', () => {
    const filters = parseCampusMapQuery({
      area: ['7', '3', '5'],
      category: 'vendor,stage',
      q: '祭',
    });
    expect(buildCampusMapHref(filters)).toBe(
      '/map?q=%E7%A5%AD&category=stage,vendor&area=3',
    );
  });
});

const THEME_COLORS = tailwindConfig.theme?.extend?.colors as Record<
  string,
  string
>;

describe('resolveAreaColor', () => {
  it('既知のトークンは対応する CSS 色値に解決する', () => {
    expect(resolveAreaColor('accent')).toBe(THEME_COLORS.accent);
  });

  it('未設定・未知の値は既定色 (secondary) に解決する', () => {
    expect(resolveAreaColor(undefined)).toBe(THEME_COLORS.secondary);
    expect(resolveAreaColor(null)).toBe(THEME_COLORS.secondary);
    expect(resolveAreaColor('not-a-token')).toBe(THEME_COLORS.secondary);
  });
});

const VALID_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [139.0, 36.4],
      [139.1, 36.4],
      [139.1, 36.5],
      [139.0, 36.5],
      [139.0, 36.4],
    ],
  ],
};

type MockDocs = {
  areas?: unknown[];
  exhibitions?: unknown[];
  stages?: unknown[];
  slots?: unknown[];
};

function mockCmsCollections({
  areas = [],
  exhibitions = [],
  stages = [],
  slots = [],
}: MockDocs) {
  vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
    const table: Record<string, unknown[]> = {
      map_areas: areas,
      student_exhibitions: exhibitions,
      stages,
      performance_slots: slots,
    };
    const docs = table[collection];
    if (docs === undefined) {
      throw new Error(`unexpected collection: ${collection}`);
    }
    return { ok: true, value: { docs, totalDocs: docs.length } };
  }) as never);
}

describe('getCampusMapData', () => {
  it('エリア取得は 1 回のみ', async () => {
    mockCmsCollections({});
    await getCampusMapData();
    const calls = vi
      .mocked(cms.findMany)
      .mock.calls.filter(([collection]) => collection === 'map_areas');
    expect(calls).toHaveLength(1);
  });

  it('公開状態を企画 ID 昇順で明示的に CMS へ送る', async () => {
    mockCmsCollections({});
    await getCampusMapData();
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'student_exhibitions');
    expect(call?.[1]?.where).toEqual({ status: { equals: 'published' } });
    expect(call?.[1]?.sort).toEqual(['id']);
  });

  it('非公開の出展物は取得結果に含まれない (CMS が where 条件でアクセス制御する前提を再現)', async () => {
    const allExhibitions = [
      {
        id: 1,
        organization_name: '公開団体',
        area_id: null,
        categories: ['exhibit'],
        status: 'published',
        exhibit: { name: '公開企画', images: [] },
      },
      {
        id: 2,
        organization_name: '非公開団体',
        area_id: null,
        categories: ['exhibit'],
        status: 'draft',
        exhibit: { name: '非公開企画', images: [] },
      },
    ];

    vi.mocked(cms.findMany).mockImplementation((async (
      collection: string,
      options?: { where?: { status?: { equals?: string } } },
    ) => {
      if (collection === 'student_exhibitions') {
        const status = options?.where?.status?.equals;
        const docs = allExhibitions.filter((e) => e.status === status);
        return { ok: true, value: { docs, totalDocs: docs.length } };
      }
      const table: Record<string, unknown[]> = {
        map_areas: [],
        stages: [],
        performance_slots: [],
      };
      const docs = table[collection] ?? [];
      return { ok: true, value: { docs, totalDocs: docs.length } };
    }) as never);

    const result = await getCampusMapData();
    expect(result.exhibitions.kind).toBe('loaded');
    if (result.exhibitions.kind === 'loaded') {
      expect(result.exhibitions.value.map((c) => c.organizationName)).toEqual([
        '公開団体',
      ]);
    }
  });

  it('エリア取得が失敗し出展物取得が成功したとき、エリア側はエラー・出展物側は読み込み済みで返り、カードの所在地が空になる', async () => {
    vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
      if (collection === 'map_areas') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      const table: Record<string, unknown[]> = {
        student_exhibitions: [
          {
            id: 1,
            organization_name: '団体A',
            area_id: 10,
            booth_label: 'A-1',
            categories: ['exhibit'],
            exhibit: { name: '企画A', images: [] },
          },
        ],
        stages: [],
        performance_slots: [],
      };
      const docs = table[collection] ?? [];
      return { ok: true, value: { docs, totalDocs: docs.length } };
    }) as never);

    const result = await getCampusMapData();
    expect(result.areas).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
    expect(result.exhibitions.kind).toBe('loaded');
    if (result.exhibitions.kind === 'loaded') {
      expect(result.exhibitions.value[0]?.location).toBeNull();
    }
  });

  it('出展物側の取得 (stages) が失敗しても、エリア取得は独立して成功する', async () => {
    vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
      if (collection === 'stages') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      const table: Record<string, unknown[]> = {
        map_areas: [],
        student_exhibitions: [],
        performance_slots: [],
      };
      const docs = table[collection] ?? [];
      return { ok: true, value: { docs, totalDocs: docs.length } };
    }) as never);

    const result = await getCampusMapData();
    expect(result.areas).toEqual({ kind: 'loaded', value: [] });
    expect(result.exhibitions).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
  });

  it('sort 昇順に並び、未設定 (null) は末尾に置かれる', async () => {
    mockCmsCollections({
      areas: [
        { id: 1, name: 'Bゾーン', geometry: VALID_POLYGON, sort: null },
        { id: 2, name: 'Aゾーン', geometry: VALID_POLYGON, sort: 2 },
        { id: 3, name: 'Cゾーン', geometry: VALID_POLYGON, sort: 1 },
      ],
    });

    const result = await getCampusMapData();
    expect(result.areas.kind).toBe('loaded');
    if (result.areas.kind === 'loaded') {
      expect(result.areas.value.map((a) => a.id)).toEqual([3, 2, 1]);
    }
  });

  it('geometry の検証に失敗したエリアは除外し、残りを返す', async () => {
    mockCmsCollections({
      areas: [
        {
          id: 1,
          name: '不正',
          geometry: { type: 'Polygon', coordinates: [] },
          sort: 1,
        },
        { id: 2, name: '正常', geometry: VALID_POLYGON, sort: 2 },
      ],
    });

    const result = await getCampusMapData();
    expect(result.areas.kind).toBe('loaded');
    if (result.areas.kind === 'loaded') {
      expect(result.areas.value.map((a) => a.id)).toEqual([2]);
    }
  });

  it('表示色が未設定・未知の値のエリアは既定色 (secondary) に解決する', async () => {
    mockCmsCollections({
      areas: [
        { id: 1, name: 'A', geometry: VALID_POLYGON, color: null, sort: 1 },
        {
          id: 2,
          name: 'B',
          geometry: VALID_POLYGON,
          color: 'not-a-token',
          sort: 2,
        },
        { id: 3, name: 'C', geometry: VALID_POLYGON, color: 'accent', sort: 3 },
      ],
    });

    const result = await getCampusMapData();
    expect(result.areas.kind).toBe('loaded');
    if (result.areas.kind === 'loaded') {
      expect(result.areas.value.map((a) => a.color)).toEqual([
        'secondary',
        'secondary',
        'accent',
      ]);
    }
  });

  it('絞り込みを行わず、選択しているカテゴリごとに分割した全カードを返す', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: null,
          categories: ['stage', 'exhibit'],
          stage: { name: '企画A-出演', images: [] },
          exhibit: { name: '企画A-展示', images: [] },
        },
      ],
    });

    const result = await getCampusMapData();
    expect(result.exhibitions.kind).toBe('loaded');
    if (result.exhibitions.kind === 'loaded') {
      expect(result.exhibitions.value).toHaveLength(2);
    }
  });

  it('エリアに属する出展物として、直接指す企画と出演ステージ経由で属する企画の双方を areaIds に含める', async () => {
    mockCmsCollections({
      exhibitions: [
        {
          id: 1,
          organization_name: '団体A',
          area_id: null,
          categories: ['stage'],
          stage: { name: '企画A-出演', images: [] },
        },
      ],
      slots: [{ id: 100, stage_id: 1, time_slot_id: 1, exhibition_id: 1 }],
      stages: [{ id: 1, name: 'メインステージ', area_id: 20 }],
    });

    const result = await getCampusMapData();
    expect(result.exhibitions.kind).toBe('loaded');
    if (result.exhibitions.kind === 'loaded') {
      expect(result.exhibitions.value[0]?.areaIds).toEqual([20]);
    }
  });
});

describe('getCampusMapAreas', () => {
  it('エリアのみを要求し、出展物・ステージ・上演枠は取得しない', async () => {
    mockCmsCollections({
      areas: [{ id: 1, name: 'Aゾーン', geometry: VALID_POLYGON, sort: 1 }],
    });

    await getCampusMapAreas();

    const collections = vi
      .mocked(cms.findMany)
      .mock.calls.map(([collection]) => collection);
    expect(collections).toEqual(['map_areas']);
  });

  it('取得に成功した場合は getCampusMapData と同じ変換規則でエリアを返す', async () => {
    mockCmsCollections({
      areas: [
        { id: 1, name: 'Bゾーン', geometry: VALID_POLYGON, sort: null },
        { id: 2, name: 'Aゾーン', geometry: VALID_POLYGON, sort: 1 },
      ],
    });

    const result = await getCampusMapAreas();
    expect(result).toEqual({
      kind: 'loaded',
      value: [
        {
          id: 2,
          name: 'Aゾーン',
          geometry: VALID_POLYGON,
          color: 'secondary',
          sort: 1,
        },
        {
          id: 1,
          name: 'Bゾーン',
          geometry: VALID_POLYGON,
          color: 'secondary',
          sort: null,
        },
      ],
    });
  });

  it('取得に失敗した場合は既存のエリア取得と同じ形のエラー結果を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });

    const result = await getCampusMapAreas();
    expect(result).toEqual({
      kind: 'error',
      error: { kind: 'network', status: 500 },
    });
  });
});

describe('getCampusMapLastModified', () => {
  it('区画・ステージ・公演枠・公開済み企画の最大更新日時を返す', async () => {
    vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
      const table: Record<string, { updatedAt: string }[]> = {
        map_areas: [{ updatedAt: '2023-01-01T00:00:00.000Z' }],
        stages: [{ updatedAt: '2023-03-01T00:00:00.000Z' }],
        performance_slots: [{ updatedAt: '2023-02-01T00:00:00.000Z' }],
        student_exhibitions: [{ updatedAt: '2023-04-01T00:00:00.000Z' }],
      };
      const docs = table[collection] ?? [];
      return { ok: true, value: { docs, totalDocs: docs.length } };
    }) as never);

    expect(await getCampusMapLastModified()).toBe('2023-04-01T00:00:00.000Z');
  });

  it('公開済み企画のみを対象にする where 条件を明示的に送る', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { docs: [], totalDocs: 0 },
    } as never);

    await getCampusMapLastModified();
    const call = vi
      .mocked(cms.findMany)
      .mock.calls.find(([collection]) => collection === 'student_exhibitions');
    expect(call?.[1]?.where).toEqual({ status: { equals: 'published' } });
  });

  it('一部の取得が失敗しても、成功した取得の最大値を返す', async () => {
    vi.mocked(cms.findMany).mockImplementation((async (collection: string) => {
      if (collection === 'stages') {
        return { ok: false, error: { kind: 'network', status: 500 } };
      }
      const table: Record<string, { updatedAt: string }[]> = {
        map_areas: [{ updatedAt: '2023-01-01T00:00:00.000Z' }],
        performance_slots: [{ updatedAt: '2023-02-01T00:00:00.000Z' }],
        student_exhibitions: [],
      };
      const docs = table[collection] ?? [];
      return { ok: true, value: { docs, totalDocs: docs.length } };
    }) as never);

    expect(await getCampusMapLastModified()).toBe('2023-02-01T00:00:00.000Z');
  });

  it('全取得が失敗した場合は null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    } as never);

    expect(await getCampusMapLastModified()).toBeNull();
  });

  it('取得は成功したがどのコレクションにもレコードが無い場合は null を返す', async () => {
    vi.mocked(cms.findMany).mockResolvedValue({
      ok: true,
      value: { docs: [], totalDocs: 0 },
    } as never);

    expect(await getCampusMapLastModified()).toBeNull();
  });
});
