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
  parseAreaGeometry,
  type MultiPolygonGeometry,
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

// CMS (4e831ba) は色を Hex で保存するが、本番デプロイ前のフロントは旧仕様の
// トークン名 (tailwind.config.ts のカラートークンと同名) も読める必要がある
const LEGACY_COLOR_TOKENS = [
  'primary',
  'secondary',
  'accent',
  'accent-alt',
  'info',
  'success',
  'warning',
] as const;
type LegacyColorToken = (typeof LEGACY_COLOR_TOKENS)[number];

const DEFAULT_COLOR_TOKEN: LegacyColorToken = 'secondary';

// Tailwind v4 を JS config 経由で使う本リポジトリでは `--color-*` の CSS カスタムプロパティが
// 生成されないため、色値の取得元は tailwind.config.ts のオブジェクトそのものにする (hex を二重に持たない)。
const THEME_COLORS = tailwindConfig.theme?.extend?.colors as Record<
  LegacyColorToken,
  string
>;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isLegacyColorToken(value: string): value is LegacyColorToken {
  return (LEGACY_COLOR_TOKENS as readonly string[]).includes(value);
}

/**
 * 表示色を CSS 色値 (Hex) に解決する。Hex はそのまま使い、旧トークン名は
 * tailwind テーマ値へ変換する。それ以外・未設定は既定色 (secondary) にする。
 */
export function resolveAreaColor(color: string | null | undefined): string {
  if (color && HEX_COLOR_PATTERN.test(color)) return color;
  if (color && isLegacyColorToken(color)) return THEME_COLORS[color];
  return THEME_COLORS[DEFAULT_COLOR_TOKEN];
}

// --- データ取得 ---------------------------------------------------------

/** 描画可能と判定済みのエリア。geometry は検証済みで型が確定している */
export interface CampusMapArea {
  readonly id: number;
  readonly name: string;
  readonly geometry: MultiPolygonGeometry;
  /** 解決済みの CSS 色値 (Hex)。resolveAreaColor 済みでそのまま描画に使える */
  readonly color: string;
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
export function toCampusMapArea(area: MapArea): CampusMapArea | null {
  const parsed = parseAreaGeometry(area.geometry);
  if (parsed.kind === 'invalid') return null;
  return {
    id: area.id,
    name: area.name,
    geometry: parsed.value,
    color: resolveAreaColor(area.color),
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

function fetchMapAreasDocs() {
  return cms.findMany('map_areas', { sort: ['sort'], limit: 0, depth: 0 });
}

function convertMapAreas(docs: readonly MapArea[]): readonly CampusMapArea[] {
  return sortCampusMapAreas(
    docs.map(toCampusMapArea).filter((a): a is CampusMapArea => a !== null),
  );
}

/** エリアのみを取得する。出展物・ステージ・上演枠は取得しない */
export async function getCampusMapAreas(): Promise<
  CampusMapDataResult['areas']
> {
  const areasResult = await fetchMapAreasDocs();
  return areasResult.ok
    ? { kind: 'loaded', value: convertMapAreas(areasResult.value.docs) }
    : { kind: 'error', error: areasResult.error };
}

/**
 * エリアと全出展物カードを取得する。例外を投げず結果型で返す。
 * エリアの取得は 1 回のみとし、出展物側の結合コンテキスト構築にも同じ結果を使う
 * (`fetchJoinSources` はエリア取得を内包しており、独立した結果表現と両立しないため使わない)。
 */
export async function getCampusMapData(): Promise<CampusMapDataResult> {
  const [areasResult, exhibitionsResult, stagesResult, slotsResult] =
    await Promise.all([
      fetchMapAreasDocs(),
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
    ? { kind: 'loaded', value: convertMapAreas(areasResult.value.docs) }
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

/**
 * sitemap 用。`/map` を構成するコレクション (区画・ステージ・公演枠・公開済み企画) それぞれの
 * 最新 1 件の `updatedAt` から最大値を求める。全取得が失敗した場合のみ null を返す
 * (要件 4.6 のとおり sitemap エントリ自体は残し、lastModified だけ省略させる)。
 */
export async function getCampusMapLastModified(): Promise<string | null> {
  const results = await Promise.all([
    cms.findMany('map_areas', { sort: ['-updatedAt'], limit: 1, depth: 0 }),
    cms.findMany('stages', { sort: ['-updatedAt'], limit: 1, depth: 0 }),
    cms.findMany('performance_slots', {
      sort: ['-updatedAt'],
      limit: 1,
      depth: 0,
    }),
    cms.findMany('student_exhibitions', {
      where: { status: { equals: 'published' } },
      sort: ['-updatedAt'],
      limit: 1,
      depth: 0,
    }),
  ]);

  const timestamps: string[] = [];
  for (const result of results) {
    if (!result.ok) continue;
    const updatedAt = result.value.docs[0]?.updatedAt;
    if (updatedAt) timestamps.push(updatedAt);
  }

  return timestamps.length > 0
    ? timestamps.reduce((latest, t) => (t > latest ? t : latest))
    : null;
}
