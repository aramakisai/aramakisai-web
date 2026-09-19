import type {
  Media,
  PerformanceSlot,
  Stage,
  StudentExhibition,
  MapArea,
} from '@/cms-types';
import { cms, type CmsFetchError } from './cms';

export type ExhibitionCategory = 'stage' | 'exhibit' | 'vendor' | 'other';

export const CATEGORY_LABELS: Readonly<Record<ExhibitionCategory, string>> = {
  stage: 'ステージ',
  exhibit: '展示',
  vendor: '出店',
  other: 'その他',
};

/** カード分割・並び替え・既定カテゴリ解決が従う定義順 */
export const CATEGORY_VALUES: readonly ExhibitionCategory[] = [
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
    'x' | 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'line' | 'website';
  readonly url: string;
}

/**
 * 企画カード 1 枚分の表示モデル。1 企画レコードが選択しているカテゴリごとに
 * 1 件の `ExhibitionCardSummary` を生成する (企画は CMS 側で 1 つ以上のカテゴリ選択を保証、要件 1.2)。
 */
export interface ExhibitionCardSummary {
  readonly id: number;
  /** このカードが表すカテゴリ (要件 1.2, 3.4) */
  readonly category: ExhibitionCategory;
  /** そのカテゴリの企画内容の企画名 (要件 3.4) */
  readonly displayName: string;
  readonly organizationName: string;
  /** カードの文脈 (category) に応じた場所文字列。未設定なら null (要件 4.5) */
  readonly location: string | null;
  /** 絞り込み用。直接設定されたエリアと出演ステージ由来のエリアの和 (要件 2.5)。カテゴリに関わらず企画単位で同じ値 */
  readonly areaIds: readonly number[];
  readonly thumbnail: ExhibitionImage | null;
}

export interface ExhibitionDetail extends ExhibitionCardSummary {
  readonly description: string | null;
  readonly images: readonly ExhibitionImage[];
  readonly links: readonly ExhibitionLink[];
  /** この企画が選択している全カテゴリ (カテゴリ定義順)。詳細ページのカテゴリ一覧表示に使う (要件 5.2) */
  readonly categories: readonly ExhibitionCategory[];
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
  readonly items: readonly ExhibitionCardSummary[];
  /** 一致した企画カードの総枚数 (要件 1.6) */
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

/** CATEGORY_VALUES は CMS の select 選択肢順 (cms/src/collections/student-exhibitions.ts) と一致させてある */
function sortCategories(
  categories: readonly ExhibitionCategory[],
): ExhibitionCategory[] {
  return [...categories].sort(
    (a, b) => CATEGORY_VALUES.indexOf(a) - CATEGORY_VALUES.indexOf(b),
  );
}

function sortAreaIds(areaIds: readonly number[]): number[] {
  return [...areaIds].sort((a, b) => a - b);
}

export function parseExhibitionQuery(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): ExhibitionQuery {
  const qRaw = params.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? '';

  const categories = sortCategories(
    Array.from(new Set(toValues(params.category).filter(isExhibitionCategory))),
  );

  const areaIds = sortAreaIds(
    Array.from(
      new Set(
        toValues(params.area)
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ),
  );

  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;
  const parsedPage = Number(pageRaw);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return { q, categories, areaIds, page };
}

/**
 * 検証済みクエリ → URL。同じ条件集合なら選択順によらず同一の文字列になるよう
 * カテゴリ・エリアを常にソートしてから連結する。パスを引数に取ることで、
 * 企画一覧 (`buildExhibitionsHref`) と構内マップ (`buildCampusMapHref`) が
 * 同じ正規化を共有できるようにする。
 */
export function buildFilterHref(
  path: string,
  query: {
    readonly q: string;
    readonly categories: readonly ExhibitionCategory[];
    readonly areaIds: readonly number[];
    readonly page?: number;
  },
): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);

  const categories = sortCategories(query.categories);
  if (categories.length > 0) params.set('category', categories.join(','));

  const areaIds = sortAreaIds(query.areaIds);
  if (areaIds.length > 0) params.set('area', areaIds.join(','));

  if (query.page !== undefined && query.page > 1) {
    params.set('page', String(query.page));
  }

  // URLSearchParams はカンマを %2C にするが、カンマは RFC 3986 の query で
  // そのまま使える文字なので、読みやすさを優先して戻す。
  const qs = params.toString().replaceAll('%2C', ',');
  return qs ? `${path}?${qs}` : path;
}

export function buildExhibitionsHref(query: {
  readonly q: string;
  readonly categories: readonly ExhibitionCategory[];
  readonly areaIds: readonly number[];
  readonly page?: number;
}): string {
  return buildFilterHref('/exhibitions', query);
}

/** 全角/半角・大文字小文字を吸収する照合用の正規化。ひらがな/カタカナは区別する (要件 2.2 の範囲外) */
export function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

// --- 絞り込み・ページング ----------------------------------------------

export function filterExhibitions(
  items: readonly ExhibitionCardSummary[],
  query: ExhibitionQuery,
): readonly ExhibitionCardSummary[] {
  const q = normalizeText(query.q.trim());
  return items.filter((item) => {
    if (q) {
      const matches =
        normalizeText(item.displayName).includes(q) ||
        normalizeText(item.organizationName).includes(q);
      if (!matches) return false;
    }
    if (
      query.categories.length > 0 &&
      !query.categories.includes(item.category)
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
): {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageCount: number;
} {
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
function toRefId(
  ref: number | { id: number } | null | undefined,
): number | null {
  if (ref === null || ref === undefined) return null;
  return typeof ref === 'object' ? ref.id : ref;
}

function toExhibitionImage(
  media: number | Media,
  fallbackAlt: string,
): ExhibitionImage {
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

export function buildJoinContext(
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

function stagesOf(
  exhibition: Pick<StudentExhibition, 'id'>,
  context: JoinContext,
): readonly Stage[] {
  const slots = context.slotsByExhibitionId.get(exhibition.id) ?? [];
  const stageIds = Array.from(
    new Set(slots.map((s) => toRefId(s.stage_id))),
  ).filter((id): id is number => id !== null);
  return stageIds
    .map((id) => context.stagesById.get(id))
    .filter((s): s is Stage => s !== undefined);
}

/** 絞り込み用エリア ID。カードのカテゴリに関わらず、直接エリアと出演ステージ由来エリアの和を返す (要件 2.5) */
function resolveAreaIds(
  exhibition: Pick<StudentExhibition, 'id' | 'area_id'>,
  context: JoinContext,
): readonly number[] {
  const areaIds = new Set<number>();
  const directAreaId = toRefId(exhibition.area_id);
  if (directAreaId !== null) areaIds.add(directAreaId);
  for (const stage of stagesOf(exhibition, context)) {
    const stageAreaId = toRefId(stage.area_id);
    if (stageAreaId !== null) areaIds.add(stageAreaId);
  }
  return Array.from(areaIds);
}

/**
 * カードの文脈 (category) に応じた場所文字列を導く。`stage` は出演ステージ名のみ、
 * それ以外はエリア名のみを見る一系統の解決で、優先順位の分岐は持たない (要件 4.1〜4.5)。
 */
function resolveLocationForCategory(
  exhibition: Pick<StudentExhibition, 'id' | 'area_id' | 'booth_label'>,
  category: ExhibitionCategory,
  context: JoinContext,
): string | null {
  if (category === 'stage') {
    const stages = stagesOf(exhibition, context);
    return stages.length > 0
      ? Array.from(new Set(stages.map((s) => s.name))).join('、')
      : null;
  }

  const directAreaId = toRefId(exhibition.area_id);
  const directArea =
    directAreaId !== null ? context.areasById.get(directAreaId) : undefined;
  if (!directArea) return null;
  return exhibition.booth_label
    ? `${directArea.name} ${exhibition.booth_label}`
    : directArea.name;
}

/** カテゴリ別企画内容欄 (`stage` / `exhibit` / `vendor` / `other`) 1 件分 */
type ExhibitionCategoryContent = NonNullable<StudentExhibition['stage']>;

/**
 * カテゴリ別企画内容欄から企画カードを組み立てる。企画名が空 (壊れたデータ) の
 * 場合は null を返し、そのカテゴリのカードを生成しない (CMS 側では選択済みカテゴリの
 * 企画名を必須にしているため通常発生しないが、表示側では欠損データでも落ちないようにする)。
 */
function toCard(
  exhibition: StudentExhibition,
  category: ExhibitionCategory,
  context: JoinContext,
): ExhibitionCardSummary | null {
  const content: ExhibitionCategoryContent | undefined = exhibition[category];
  const displayName = content?.name;
  if (!displayName) return null;

  const images = content?.images ?? [];
  return {
    id: exhibition.id,
    category,
    displayName,
    organizationName: exhibition.organization_name,
    location: resolveLocationForCategory(exhibition, category, context),
    areaIds: resolveAreaIds(exhibition, context),
    thumbnail:
      images.length > 0 ? toExhibitionImage(images[0]!, displayName) : null,
  };
}

/**
 * 企画レコードが選択している `categories` をカテゴリ定義順 (`CATEGORY_VALUES`) に
 * 走査し、企画カードへ展開する (要件 1.2)。この順序をそのまま保つため、この結果を
 * `flatMap` するだけで ID 昇順 × カテゴリ定義順 (要件 1.3) を満たす。
 */
export function toCards(
  exhibition: StudentExhibition,
  context: JoinContext,
): ExhibitionCardSummary[] {
  return CATEGORY_VALUES.filter((category) =>
    exhibition.categories.includes(category),
  )
    .map((category) => toCard(exhibition, category, context))
    .filter((card): card is ExhibitionCardSummary => card !== null);
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
  const [exhibitionsResult, [slotsResult, stagesResult, areasResult]] =
    await Promise.all([
      cms.findMany('student_exhibitions', {
        where: { status: { equals: 'published' } },
        sort: ['id'],
        limit: 0,
        depth: 0,
      }),
      fetchJoinSources(),
    ]);
  if (
    !exhibitionsResult.ok ||
    !slotsResult.ok ||
    !stagesResult.ok ||
    !areasResult.ok
  ) {
    throw new Error('企画一覧の取得に失敗しました');
  }

  const context = buildJoinContext(
    slotsResult.value.docs,
    stagesResult.value.docs,
    areasResult.value.docs,
  );
  const cards = exhibitionsResult.value.docs.flatMap((e) =>
    toCards(e, context),
  );
  const filtered = filterExhibitions(cards, query);
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
 * 詳細ページ用の結果。不在・非公開・URL の category をその企画が選択していない場合 (missing) と
 * 取得失敗 (error) を必ず区別する。両者を null へ潰すと要件 5.9 (CMS 障害を 404 にしない) を満たせない。
 */
export async function getExhibitionDetail(
  id: number,
  category: ExhibitionCategory,
): Promise<ExhibitionDetailResult> {
  const exhibitionResult = await cms.findById('student_exhibitions', id, {
    depth: 1,
  });
  if (!exhibitionResult.ok) {
    if (exhibitionResult.error.kind === 'network') {
      return { kind: 'error', error: exhibitionResult.error };
    }
    // not_found と unauthorized (非公開レコードへの参照) は利用者から区別できない扱いとする (要件 5.8)
    return { kind: 'missing' };
  }
  const exhibition = exhibitionResult.value;
  if (exhibition.status !== 'published') {
    return { kind: 'missing' };
  }

  if (!exhibition.categories.includes(category)) {
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
  const card = toCard(exhibition, category, context);
  // 選択済みカテゴリの企画名が空 (壊れたデータ) の場合も不在として扱う (toCards と同じ規約)
  if (!card) {
    return { kind: 'missing' };
  }

  const content: ExhibitionCategoryContent | undefined = exhibition[category];
  const images = content?.images ?? [];

  return {
    kind: 'found',
    value: {
      ...card,
      description: content?.description ?? null,
      images: images.map((image) => toExhibitionImage(image, card.displayName)),
      links: (exhibition.links ?? []).map((link) => ({
        platform: link.platform,
        url: link.url,
      })),
      categories: CATEGORY_VALUES.filter((c) =>
        exhibition.categories.includes(c),
      ),
    },
  };
}
