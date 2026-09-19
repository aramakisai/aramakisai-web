import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CampusMapArea,
  CampusMapDataResult,
  CampusMapFilters,
} from '@/lib/campus-map';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

type DynamicOptions = {
  readonly ssr?: boolean;
  readonly loading?: () => ReactNode;
};

// vi.mock はファイル先頭へ巻き上げられるため、参照する可変値は vi.hoisted で用意する
const state = vi.hoisted(() => ({
  mapViewProps: [] as Record<string, unknown>[],
  dynamicOptions: undefined as DynamicOptions | undefined,
}));

// CampusMapView (Leaflet 依存) の実体を読み込ませず、渡された props と
// dynamic() の呼び出しオプション自体を検証対象にする
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: DynamicOptions) => {
    state.dynamicOptions = options;
    return function MockedCampusMapView(props: Record<string, unknown>) {
      state.mapViewProps.push(props);
      const onSelectArea = props.onSelectArea as (
        areaId: number | null,
      ) => void;
      return (
        <div data-testid="campus-map-view">
          <button onClick={() => onSelectArea(1)}>select-area-1</button>
        </div>
      );
    };
  },
}));

const { mapViewProps } = state;

import { CampusMapScreen } from './campus-map-screen';

function area(overrides: Partial<CampusMapArea> = {}): CampusMapArea {
  return {
    id: 1,
    name: '中央エリア',
    color: 'primary',
    sort: 0,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    },
    ...overrides,
  };
}

function card(
  overrides: Partial<ExhibitionCardSummary> = {},
): ExhibitionCardSummary {
  return {
    id: 1,
    category: 'exhibit',
    displayName: '企画',
    organizationName: '団体',
    location: null,
    areaIds: [],
    thumbnail: null,
    ...overrides,
  };
}

function baseFilters(
  overrides: Partial<CampusMapFilters> = {},
): CampusMapFilters {
  return { q: '', categories: [], selectedAreaId: null, ...overrides };
}

function dataResult(
  overrides: Partial<CampusMapDataResult> = {},
): CampusMapDataResult {
  return {
    areas: { kind: 'loaded', value: [] },
    exhibitions: { kind: 'loaded', value: [] },
    ...overrides,
  };
}

/** MapSidePanel (desktop) を可視・操作可能にする。matchMedia を一致させる */
function stubDesktop() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  state.mapViewProps.length = 0;
  window.history.replaceState(null, '', '/map');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CampusMapScreen', () => {
  it('places the menu button, search, list, and map in that document order (要件 10.4)', () => {
    stubDesktop();
    render(
      <CampusMapScreen
        data={dataResult({ areas: { kind: 'loaded', value: [area()] } })}
        initialFilters={baseFilters()}
      />,
    );

    const menuButton = screen.getByRole('button', { name: 'メニューを開く' });
    const searchbox = screen.getByRole('searchbox', { name: '企画を検索' });
    const areaGroup = screen.getByRole('group', { name: 'エリアを選択' });
    const mapView = screen.getByTestId('campus-map-view');

    const inOrder = [menuButton, searchbox, areaGroup, mapView];
    for (let i = 0; i < inOrder.length - 1; i += 1) {
      const relation = inOrder[i]!.compareDocumentPosition(inOrder[i + 1]!);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('loads the map view without SSR and shows a loading placeholder for it (要件 1.11)', () => {
    stubDesktop();
    render(
      <CampusMapScreen data={dataResult()} initialFilters={baseFilters()} />,
    );

    expect(state.dynamicOptions?.ssr).toBe(false);
    render(<>{state.dynamicOptions?.loading?.()}</>);
    expect(screen.getByText(/読み込んでいます/)).toBeInTheDocument();
  });

  it('applies area, keyword, and category conditions together without any network request (要件 4.6)', () => {
    vi.useFakeTimers();
    stubDesktop();
    const areas = [
      area({ id: 1, name: '中央エリア' }),
      area({ id: 2, name: '南エリア' }),
    ];
    const items = [
      card({
        id: 1,
        category: 'exhibit',
        displayName: 'ロボット研究会',
        areaIds: [1],
      }),
      card({
        id: 2,
        category: 'stage',
        displayName: 'ロボットバンド',
        areaIds: [1],
      }),
      card({
        id: 3,
        category: 'exhibit',
        displayName: '無関係企画',
        areaIds: [1],
      }),
      card({
        id: 4,
        category: 'exhibit',
        displayName: 'ロボットショー',
        areaIds: [2],
      }),
    ];
    render(
      <CampusMapScreen
        data={dataResult({
          areas: { kind: 'loaded', value: areas },
          exhibitions: { kind: 'loaded', value: items },
        })}
        initialFilters={baseFilters()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '中央エリア' }));
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '企画を検索' }), {
      target: { value: 'ロボット' },
    });
    act(() => vi.advanceTimersByTime(300));

    // ペイン (デスクトップ) とシート (モバイル) の双方が同じ状態を描画するため
    // (要件 5.1 / 5.2)、常に 2 件ずつ現れる。どちらか一方でも見つかれば絞り込みは正しい
    expect(screen.getAllByText('ロボット研究会').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('ロボットバンド')).toHaveLength(0);
    expect(screen.queryAllByText('無関係企画')).toHaveLength(0);
    expect(screen.queryAllByText('ロボットショー')).toHaveLength(0);
  });

  it('reflects a selection made from the map into the list (要件 2.4, 3.10)', () => {
    stubDesktop();
    const areas = [area({ id: 1, name: '中央エリア' })];
    const items = [
      card({
        id: 1,
        category: 'exhibit',
        displayName: '中央の企画',
        areaIds: [1],
      }),
    ];
    render(
      <CampusMapScreen
        data={dataResult({
          areas: { kind: 'loaded', value: areas },
          exhibitions: { kind: 'loaded', value: items },
        })}
        initialFilters={baseFilters()}
      />,
    );

    fireEvent.click(screen.getByText('select-area-1'));

    expect(screen.getAllByText('中央の企画').length).toBeGreaterThan(0);
    expect(window.location.search).toBe('?area=1');
  });

  it('shows an error in the list but keeps the map interactive when exhibitions fail to load (要件 8.2)', () => {
    stubDesktop();
    render(
      <CampusMapScreen
        data={dataResult({
          exhibitions: {
            kind: 'error',
            error: { kind: 'network', status: 500 },
          },
        })}
        initialFilters={baseFilters()}
      />,
    );

    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByTestId('campus-map-view')).toBeInTheDocument();
  });

  it('keeps the map and list usable while telling the visitor area data is unavailable (要件 8.1, 8.4)', () => {
    stubDesktop();
    render(
      <CampusMapScreen
        data={dataResult({
          areas: { kind: 'error', error: { kind: 'network', status: 500 } },
        })}
        initialFilters={baseFilters()}
      />,
    );

    expect(
      screen.getAllByText(/エリア情報の取得に失敗/).length,
    ).toBeGreaterThan(0);
    // ポリゴンを描画しないため空配列を渡す。地図自体の操作は維持される
    expect(mapViewProps.at(-1)!.areas).toEqual([]);
    expect(screen.getByTestId('campus-map-view')).toBeInTheDocument();
  });

  it('distinguishes an empty registry from a fetch failure (要件 3.9)', () => {
    stubDesktop();
    render(
      <CampusMapScreen
        data={dataResult({ areas: { kind: 'loaded', value: [] } })}
        initialFilters={baseFilters()}
      />,
    );

    expect(
      screen.getAllByText('エリアはまだ登録されていません').length,
    ).toBeGreaterThan(0);
  });
});
