import type { Media, PerformanceSlot, Stage, StudentExhibition, MapArea } from '@/cms-types';
import { cms, type CmsFetchError } from './cms';

export type ExhibitionCategory = 'stage' | 'exhibit' | 'vendor' | 'other';

export const CATEGORY_LABELS: Readonly<Record<ExhibitionCategory, string>> = {
  stage: 'ステージ',
  exhibit: '展示',
  vendor: '出店',
  other: 'その他',
};

const CATEGORY_VALUES: readonly ExhibitionCategory[] = [
  'stage',
  'exhibit',
  'vendor',
  'other',
];

export interface ExhibitionImage {
  readonly id: string;
  readonly alt: string;
}

export interface ExhibitionLink {
  readonly platform:
    | 'x'
    | 'instagram'
    | 'facebook'
    | 'youtube'
    | 'tiktok'
    | 'line'
    | 'website';
  readonly url: string;
}

export interface ExhibitionSummary {
  readonly id: number;
  readonly name: string;
  /** ステージ文脈での表示名。`stage_name` 未入力なら `name` と同じ値 (要件 5.9) */
  readonly stageName: string;
  readonly organizationName: string;
  readonly categories: readonly ExhibitionCategory[];
  /** 表示用の場所文字列。未設定なら null (要件 4.6) */
  readonly location: string | null;
  /** 絞り込み用。直接設定されたエリアと出演ステージ由来のエリアの和 (要件 2.5) */
  readonly areaIds: readonly number[];
  readonly thumbnail: ExhibitionImage | null;
}

export interface ExhibitionDetail extends ExhibitionSummary {
  readonly description: string | null;
  readonly images: readonly ExhibitionImage[];
  readonly links: readonly ExhibitionLink[];
}

export interface AreaOption {
  readonly id: number;
  readonly name: string;
}

export interface ExhibitionQuery {
  readonly q: string;
  readonly categories: readonly ExhibitionCategory[];
  readonly areaIds: readonly number[];
  readonly page: number;
}

export interface ExhibitionListResult {
  readonly items: readonly ExhibitionSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly areas: readonly AreaOption[];
}

export type ExhibitionDetailResult =
  | { readonly kind: 'found'; readonly value: ExhibitionDetail }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error'; readonly error: CmsFetchError };

export const PAGE_SIZE = 24;

// --- クエリの解釈 -----------------------------------------------------

function isExhibitionCategory(value: string): value is ExhibitionCategory {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

/** 配列指定 (`?a=1&a=2`) とカンマ区切り (`?a=1,2`) のどちらも受け付ける */
function toValues(raw: string | readonly string[] | undefined): string[] {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function parseExhibitionQuery(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): ExhibitionQuery {
  const qRaw = params.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? '';

  const categories = Array.from(
    new Set(toValues(params.category).filter(isExhibitionCategory)),
  );

  const areaIds = Array.from(
    new Set(
      toValues(params.area)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  );

  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number(pageRaw);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { q, categories, areaIds, page };
}

/** 全角/半角・大文字小文字を吸収する照合用の正規化。ひらがな/カタカナは区別する (要件 2.2 の範囲外) */
export function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

// --- 絞り込み・ページング ----------------------------------------------

export function filterExhibitions(
  items: readonly ExhibitionSummary[],
  query: ExhibitionQuery,
): readonly ExhibitionSummary[] {
  const q = normalizeText(query.q.trim());
  return items.filter((item) => {
    if (q) {
      const matches =
        normalizeText(item.name).includes(q) ||
        normalizeText(item.organizationName).includes(q);
      if (!matches) return false;
    }
    if (
      query.categories.length > 0 &&
      !item.categories.some((c) => query.categories.includes(c))
    ) {
      return false;
    }
    if (
      query.areaIds.length > 0 &&
      !item.areaIds.some((id) => query.areaIds.includes(id))
    ) {
      return false;
    }
    return true;
  });
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = PAGE_SIZE,
): { readonly items: readonly T[]; readonly page: number; readonly pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Number.isFinite(page) ? Math.trunc(page) : 1;
  const clampedPage = Math.min(Math.max(1, safePage), pageCount);
  const start = (clampedPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: clampedPage,
    pageCount,
  };
}

// --- CMS からの取得と結合 ----------------------------------------------

/** 数値 ID / populate 済みオブジェクトのどちらでも ID を取り出す (depth 0/1 の両対応) */
function toRefId(ref: number | { id: number } | null | undefined): number | null {
  if (ref === null || ref === undefined) return null;
  return typeof ref === 'object' ? ref.id : ref;
}

function toExhibitionImage(media: number | Media, fallbackAlt: string): ExhibitionImage {
  if (typeof media === 'object') {
    return { id: String(media.id), alt: media.alt || fallbackAlt };
  }
  return { id: String(media), alt: fallbackAlt };
}

interface JoinContext {
  readonly areasById: ReadonlyMap<number, MapArea>;
  readonly stagesById: ReadonlyMap<number, Stage>;
  readonly slotsByExhibitionId: ReadonlyMap<number, readonly PerformanceSlot[]>;
}

function buildJoinContext(
  slots: readonly PerformanceSlot[],
  stages: readonly Stage[],
  areas: readonly MapArea[],
): JoinContext {
  const areasById = new Map(areas.map((a) => [a.id, a]));
  const stagesById = new Map(stages.map((s) => [s.id, s]));
  const slotsByExhibitionId = new Map<number, PerformanceSlot[]>();
  for (const slot of slots) {
    const exhibitionId = toRefId(slot.exhibition_id);
    if (exhibitionId === null) continue;
    const list = slotsByExhibitionId.get(exhibitionId);
    if (list) list.push(slot);
    else slotsByExhibitionId.set(exhibitionId, [slot]);
  }
  return { areasById, stagesById, slotsByExhibitionId };
}

/** 場所文字列と絞り込み用エリア ID を導く。エリアと出演枠の双方があればエリアを優先する (要件 4.3) */
function resolveLocation(
  exhibition: Pick<StudentExhibition, 'id' | 'area_id' | 'booth_label'>,
  context: JoinContext,
): { location: string | null; areaIds: readonly number[] } {
  const directAreaId = toRefId(exhibition.area_id);
  const directArea = directAreaId !== null ? context.areasById.get(directAreaId) : undefined;

  const slots = context.slotsByExhibitionId.get(exhibition.id) ?? [];
  const stageIds = Array.from(new Set(slots.map((s) => toRefId(s.stage_id))))
    .filter((id): id is number => id !== null);
  const stages = stageIds
    .map((id) => context.stagesById.get(id))
    .filter((s): s is Stage => s !== undefined);

  const areaIds = new Set<number>();
  if (directAreaId !== null) areaIds.add(directAreaId);
  for (const stage of stages) {
    const stageAreaId = toRefId(stage.area_id);
    if (stageAreaId !== null) areaIds.add(stageAreaId);
  }

  let location: string | null = null;
  if (directArea) {
    location = exhibition.booth_label
      ? `${directArea.name} ${exhibition.booth_label}`
      : directArea.name;
  } else if (stages.length > 0) {
    location = Array.from(new Set(stages.map((s) => s.name))).join('、');
  }

  return { location, areaIds: Array.from(areaIds) };
}

function toExhibitionSummary(
  exhibition: StudentExhibition,
  context: JoinContext,
): ExhibitionSummary {
  const { location, areaIds } = resolveLocation(exhibition, context);
  const images = exhibition.images ?? [];
  return {
    id: exhibition.id,
    name: exhibition.name,
    stageName: exhibition.stage_name || exhibition.name,
    organizationName: exhibition.organization_name,
    categories: exhibition.category,
    location,
    areaIds,
    thumbnail: images.length > 0 ? toExhibitionImage(images[0]!, exhibition.name) : null,
  };
}

async function fetchJoinSources(exhibitionId?: number) {
  return Promise.all([
    cms.findMany('performance_slots', {
      ...(exhibitionId !== undefined
        ? { where: { exhibition_id: { equals: exhibitionId } } }
        : {}),
      limit: 0,
      depth: 0,
    }),
    cms.findMany('stages', { limit: 0, depth: 0 }),
    cms.findMany('map_areas', { sort: ['sort'], limit: 0, depth: 0 }),
  ]);
}

/** 一覧ページ用。取得失敗時は例外を投げる (既存 topics/announcements と同じ規約) */
export async function getExhibitionListData(
  query: ExhibitionQuery,
): Promise<ExhibitionListResult> {
  const [exhibitionsResult, [slotsResult, stagesResult, areasResult]] = await Promise.all([
    cms.findMany('student_exhibitions', {
      where: { status: { equals: 'published' } },
      sort: ['id'],
      limit: 0,
      depth: 0,
    }),
    fetchJoinSources(),
  ]);
  if (!exhibitionsResult.ok || !slotsResult.ok || !stagesResult.ok || !areasResult.ok) {
    throw new Error('企画一覧の取得に失敗しました');
  }

  const context = buildJoinContext(
    slotsResult.value.docs,
    stagesResult.value.docs,
    areasResult.value.docs,
  );
  const items = exhibitionsResult.value.docs.map((e) => toExhibitionSummary(e, context));
  const filtered = filterExhibitions(items, query);
  const paginated = paginate(filtered, query.page);
  const total = filtered.length;

  return {
    items: paginated.items,
    total,
    page: paginated.page,
    pageCount: paginated.pageCount,
    rangeStart: total === 0 ? 0 : (paginated.page - 1) * PAGE_SIZE + 1,
    rangeEnd: total === 0 ? 0 : Math.min(paginated.page * PAGE_SIZE, total),
    areas: areasResult.value.docs.map((a) => ({ id: a.id, name: a.name })),
  };
}

/**
 * 詳細ページ用の結果。不在・非公開 (missing) と取得失敗 (error) を必ず区別する。
 * 両者を null へ潰すと要件 5.8 (CMS 障害を 404 にしない) を満たせない。
 */
export async function getExhibitionDetail(id: number): Promise<ExhibitionDetailResult> {
  const exhibitionResult = await cms.findById('student_exhibitions', id, { depth: 1 });
  if (!exhibitionResult.ok) {
    if (exhibitionResult.error.kind === 'network') {
      return { kind: 'error', error: exhibitionResult.error };
    }
    // not_found と unauthorized (非公開レコードへの参照) は利用者から区別できない扱いとする (要件 5.7)
    return { kind: 'missing' };
  }
  const exhibition = exhibitionResult.value;
  if (exhibition.status !== 'published') {
    return { kind: 'missing' };
  }

  const [slotsResult, stagesResult, areasResult] = await fetchJoinSources(id);
  if (!slotsResult.ok) return { kind: 'error', error: slotsResult.error };
  if (!stagesResult.ok) return { kind: 'error', error: stagesResult.error };
  if (!areasResult.ok) return { kind: 'error', error: areasResult.error };

  const context = buildJoinContext(
    slotsResult.value.docs,
    stagesResult.value.docs,
    areasResult.value.docs,
  );
  const summary = toExhibitionSummary(exhibition, context);
  const images = exhibition.images ?? [];

  return {
    kind: 'found',
    value: {
      ...summary,
      description: exhibition.description ?? null,
      images: images.map((image) => toExhibitionImage(image, exhibition.name)),
      links: (exhibition.links ?? []).map((link) => ({
        platform: link.platform,
        url: link.url,
      })),
    },
  };
}
