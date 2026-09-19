import type { MapArea } from '@/cms-types';
import tailwindConfig from '../../tailwind.config';
import { cms, type CmsFetchError, type CmsResult } from './cms';
import {
  buildFilterHref,
  buildJoinContext,
  parseExhibitionQuery,
  toCards,
  type ExhibitionCardSummary,
  type ExhibitionCategory,
} from './exhibitions';
import {
  parsePolygonGeometry,
  type PolygonGeometry,
} from './campus-map-geometry';

/** 構内マップの絞り込み条件。エリアは単一選択 */
export interface CampusMapFilters {
  readonly q: string;
  readonly categories: readonly ExhibitionCategory[];
  readonly selectedAreaId: number | null;
}

/**
 * searchParams を構内マップの条件に解釈する。
 * area が複数指定された場合は最小の ID を採用する
 * (`parseExhibitionQuery` が昇順ソート済みで返すため、その先頭)。
 */
export function parseCampusMapQuery(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): CampusMapFilters {
  const { q, categories, areaIds } = parseExhibitionQuery(params);
  return { q, categories, selectedAreaId: areaIds[0] ?? null };
}

/** 構内マップの条件から URL を組み立てる。企画一覧と同じクエリ形式を共有する */
export function buildCampusMapHref(filters: CampusMapFilters): string {
  return buildFilterHref('/map', {
    q: filters.q,
    categories: filters.categories,
    areaIds: filters.selectedAreaId === null ? [] : [filters.selectedAreaId],
  });
}

// --- エリアの表示色 -----------------------------------------------------

/** マップ表示色。tailwind.config.ts のカラートークン名と一致し、DB の enum 値とも一致する */
export type MapAreaColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'accent-alt'
  | 'info'
  | 'success'
  | 'warning';

const MAP_AREA_COLORS: readonly MapAreaColor[] = [
  'primary',
  'secondary',
  'accent',
  'accent-alt',
  'info',
  'success',
  'warning',
];

const DEFAULT_MAP_AREA_COLOR: MapAreaColor = 'secondary';

// Tailwind v4 を JS config 経由で使う本リポジトリでは `--color-*` の CSS カスタムプロパティが
// 生成されないため、色値の取得元は tailwind.config.ts のオブジェクトそのものにする (hex を二重に持たない)。
const THEME_COLORS = tailwindConfig.theme?.extend?.colors as Record<
  MapAreaColor,
  string
>;

function isMapAreaColor(value: string): value is MapAreaColor {
  return (MAP_AREA_COLORS as readonly string[]).includes(value);
}

function resolveMapAreaColorToken(
  color: string | null | undefined,
): MapAreaColor {
  return color && isMapAreaColor(color) ? color : DEFAULT_MAP_AREA_COLOR;
}

/** トークン名を CSS 色値に解決する。未設定・未知の値は既定色を返す */
export function resolveAreaColor(color: string | null | undefined): string {
  return THEME_COLORS[resolveMapAreaColorToken(color)];
}

// --- データ取得 ---------------------------------------------------------

/** 描画可能と判定済みのエリア。geometry は検証済みで型が確定している */
export interface CampusMapArea {
  readonly id: number;
  readonly name: string;
  readonly geometry: PolygonGeometry;
  readonly color: MapAreaColor;
  /** CMS 側が nullable。未設定のエリアは描画順の末尾に置く */
  readonly sort: number | null;
}

/** エリア取得と出展物取得の成否を独立して表現する */
export interface CampusMapDataResult {
  readonly areas:
    | { readonly kind: 'loaded'; readonly value: readonly CampusMapArea[] }
    | { readonly kind: 'error'; readonly error: CmsFetchError };
  readonly exhibitions:
    | {
        readonly kind: 'loaded';
        readonly value: readonly ExhibitionCardSummary[];
      }
    | { readonly kind: 'error'; readonly error: CmsFetchError };
}

/** geometry の検証に失敗したエリアは描画対象から除く */
function toCampusMapArea(area: MapArea): CampusMapArea | null {
  const parsed = parsePolygonGeometry(area.geometry);
  if (parsed.kind === 'invalid') return null;
  return {
    id: area.id,
    name: area.name,
    geometry: parsed.value,
    color: resolveMapAreaColorToken(area.color),
    sort: area.sort ?? null,
  };
}

/** sort 昇順。未設定 (null) は末尾に置く */
function sortCampusMapAreas(
  areas: readonly CampusMapArea[],
): readonly CampusMapArea[] {
  return [...areas].sort((a, b) => (a.sort ?? Infinity) - (b.sort ?? Infinity));
}

function firstError(results: readonly CmsResult<unknown>[]): CmsFetchError {
  const failed = results.find(
    (r): r is { ok: false; error: CmsFetchError } => !r.ok,
  );
  // 呼び出し側は失敗が 1 本以上あることを確認してから呼ぶ
  return failed!.error;
}

/**
 * エリアと全出展物カードを取得する。例外を投げず結果型で返す。
 * エリアの取得は 1 回のみとし、出展物側の結合コンテキスト構築にも同じ結果を使う
 * (`fetchJoinSources` はエリア取得を内包しており、独立した結果表現と両立しないため使わない)。
 */
export async function getCampusMapData(): Promise<CampusMapDataResult> {
  const [areasResult, exhibitionsResult, stagesResult, slotsResult] =
    await Promise.all([
      cms.findMany('map_areas', { sort: ['sort'], limit: 0, depth: 0 }),
      cms.findMany('student_exhibitions', {
        where: { status: { equals: 'published' } },
        sort: ['id'],
        limit: 0,
        depth: 0,
      }),
      cms.findMany('stages', { limit: 0, depth: 0 }),
      cms.findMany('performance_slots', { limit: 0, depth: 0 }),
    ]);

  const areas: CampusMapDataResult['areas'] = areasResult.ok
    ? {
        kind: 'loaded',
        value: sortCampusMapAreas(
          areasResult.value.docs
            .map(toCampusMapArea)
            .filter((a): a is CampusMapArea => a !== null),
        ),
      }
    : { kind: 'error', error: areasResult.error };

  // map_areas の取得に失敗した場合は空のエリア配列を結合コンテキストへ渡す。
  // resolveLocationForCategory がエリア名を解決できず location が null になる (要件 8.4)。
  const areasForJoin = areasResult.ok ? areasResult.value.docs : [];

  const exhibitions: CampusMapDataResult['exhibitions'] =
    exhibitionsResult.ok && stagesResult.ok && slotsResult.ok
      ? {
          kind: 'loaded',
          value: exhibitionsResult.value.docs.flatMap((e) =>
            toCards(
              e,
              buildJoinContext(
                slotsResult.value.docs,
                stagesResult.value.docs,
                areasForJoin,
              ),
            ),
          ),
        }
      : {
          kind: 'error',
          error: firstError([exhibitionsResult, stagesResult, slotsResult]),
        };

  return { areas, exhibitions };
}
