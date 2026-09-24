import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MapPage, { generateMetadata } from './page';
import * as campusMapModule from '@/lib/campus-map';
import * as siteMetadataModule from '@/lib/site-metadata';
import type {
  CampusMapArea,
  CampusMapDataResult,
  CampusMapFilters,
} from '@/lib/campus-map';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import type { SiteMetadata } from '@/lib/site-metadata';

vi.mock('@/lib/campus-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/campus-map')>();
  return { ...actual, getCampusMapData: vi.fn() };
});

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(),
}));

// campus-map.ts は cms.ts 経由で env.ts を import し、env.ts はモジュール評価時に
// 環境変数を zod で検証するため、exhibitions のページテストと同様にモックする
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

// CampusMapScreen 自体の振る舞い (絞り込み・地図描画等) は campus-map-screen.test.tsx が
// 担う。ここでは page が取得結果と初期条件をそのまま渡していることだけを検証する
const screenProps: Record<string, unknown>[] = [];
vi.mock('@/components/campus-map/campus-map-screen', () => ({
  CampusMapScreen: (props: Record<string, unknown>) => {
    screenProps.push(props);
    return <div data-testid="campus-map-screen" />;
  },
}));

function area(overrides: Partial<CampusMapArea>): CampusMapArea {
  return {
    id: 1,
    name: 'エリア',
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
    color: 'secondary',
    sort: null,
    ...overrides,
  };
}

function exhibition(
  overrides: Partial<ExhibitionCardSummary>,
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

function dataResult(
  overrides: Partial<CampusMapDataResult>,
): CampusMapDataResult {
  return {
    areas: { kind: 'loaded', value: [] },
    exhibitions: { kind: 'loaded', value: [] },
    ...overrides,
  };
}

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return render(await MapPage({ searchParams: Promise.resolve(searchParams) }));
}

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

describe('MapPage', () => {
  beforeEach(() => {
    vi.mocked(campusMapModule.getCampusMapData).mockReset();
    vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
      SITE_METADATA,
    );
    screenProps.length = 0;
  });

  it('取得結果をそのまま CampusMapScreen へ渡す', async () => {
    const data = dataResult({
      areas: { kind: 'loaded', value: [area({ id: 1 }), area({ id: 2 })] },
      exhibitions: {
        kind: 'loaded',
        value: [exhibition({ id: 1 }), exhibition({ id: 2 })],
      },
    });
    vi.mocked(campusMapModule.getCampusMapData).mockResolvedValue(data);

    await renderPage();

    expect(screen.getByTestId('campus-map-screen')).toBeInTheDocument();
    expect(screenProps.at(-1)!.data).toEqual(data);
  });

  it('取得に失敗した結果もそのまま渡す (エラー握り潰しをしない)', async () => {
    const data = dataResult({
      areas: { kind: 'error', error: { kind: 'network', status: 500 } },
    });
    vi.mocked(campusMapModule.getCampusMapData).mockResolvedValue(data);

    await renderPage();

    expect(screenProps.at(-1)!.data).toEqual(data);
  });

  it('searchParams を解釈した初期条件を渡す', async () => {
    vi.mocked(campusMapModule.getCampusMapData).mockResolvedValue(
      dataResult({}),
    );

    await renderPage({ q: 'ロボット', category: 'stage', area: '3' });

    const initialFilters = screenProps.at(-1)!
      .initialFilters as CampusMapFilters;
    expect(initialFilters).toEqual({
      q: 'ロボット',
      categories: ['stage'],
      selectedAreaId: 3,
    });
  });

  it('解決したフェーズを CampusMapScreen へ渡す', async () => {
    vi.mocked(campusMapModule.getCampusMapData).mockResolvedValue(
      dataResult({}),
    );

    await renderPage();

    expect(screenProps.at(-1)!.phase).toBe('pre_event');
  });
});

describe('generateMetadata (要件2.5, 2.9)', () => {
  it('title / description を持ち、絞り込み条件を含まない canonical を設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('構内マップ');
    expect(metadata.description).toMatch(/マップ/);
    expect(metadata.alternates).toEqual({ canonical: '/map' });
  });
});
