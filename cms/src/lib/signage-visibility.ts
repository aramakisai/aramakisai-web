import type { Payload, PayloadRequest, Where } from 'payload';

type MemberKey = 'slides' | 'telops';
type MemberCollection = 'signage_slides' | 'telops';

export type VisibilityGroup = {
  is_all?: boolean | null;
  is_quake?: boolean | null;
  visible?: boolean | null;
  slides: number[];
  telops: number[];
};

const KEY: Record<MemberCollection, MemberKey> = { signage_slides: 'slides', telops: 'telops' };

const quakeMembers = (groups: VisibilityGroup[], key: MemberKey): Set<number> =>
  new Set(groups.filter((g) => g.is_quake).flatMap((g) => g[key]));

/**
 * 有効で、かつ「すべて」が表示中か表示中の通常のグループに属するものだけを、元の並びのまま返す。
 * 緊急地震速報のグループの所属は巡回・固定に混ぜないため、「すべて」が表示中でも除く
 */
export function visibleMemberIds(enabledIds: number[], groups: VisibilityGroup[], key: MemberKey): number[] {
  const quake = quakeMembers(groups, key);
  const candidates = enabledIds.filter((id) => !quake.has(id));
  if (groups.some((g) => g.is_all && g.visible)) return candidates;
  const members = new Set(groups.filter((g) => !g.is_all && !g.is_quake && g.visible).flatMap((g) => g[key]));
  return candidates.filter((id) => members.has(id));
}

type Reader = Pick<Payload, 'find'>;

type Loaded = { enabledIds: number[]; groups: VisibilityGroup[] };

const idsOf = (refs: unknown): number[] =>
  (Array.isArray(refs) ? refs : []).map((r) => (typeof r === 'object' && r !== null ? (r as { id: number }).id : r));

async function loadMembersAndGroups(
  payload: Reader,
  collection: MemberCollection,
  req?: Partial<PayloadRequest>,
): Promise<Loaded> {
  const [members, groups] = await Promise.all([
    payload.find({
      collection,
      where: { enabled: { equals: true } },
      sort: '_order',
      pagination: false,
      depth: 0,
      select: { enabled: true },
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'signage_groups',
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ]);
  return {
    enabledIds: members.docs.map((m) => m.id),
    groups: groups.docs.map((g) => ({
      is_all: g.is_all,
      is_quake: g.is_quake,
      visible: g.visible,
      slides: idsOf(g.slides),
      telops: idsOf(g.telops),
    })),
  };
}

/** 公開判定・固定の選択肢・自動解除が同じ結果を使うよう、DB から表示対象のIDを計算する */
export async function loadVisibleIds(
  payload: Reader,
  collection: MemberCollection,
  req?: Partial<PayloadRequest>,
): Promise<number[]> {
  const { enabledIds, groups } = await loadMembersAndGroups(payload, collection, req);
  return visibleMemberIds(enabledIds, groups, KEY[collection]);
}

function idsFilter(ids: number[]): Where {
  return ids.length > 0 ? { id: { in: ids } } : { id: { exists: false } };
}

/**
 * policy.ts は同期でDBを読めないため、公開判定に重ねる表示対象の条件はここで作る。
 * 一致なしは false ではなく存在しない列の条件で表す (false を返すと読み取りが 403 になる)
 */
export async function visibleFilter(
  payload: Reader,
  collection: MemberCollection,
  req?: Partial<PayloadRequest>,
): Promise<Where> {
  return idsFilter(await loadVisibleIds(payload, collection, req));
}

/**
 * 未認証・学生団体の読み取りの条件。表示対象に加え、緊急地震速報のグループの所属(有効なもの)も読める。
 * スナップショットが段階のスライドを取得するのに必要で、巡回の一覧からはフロント側で除く
 */
export async function publicFilter(
  payload: Reader,
  collection: MemberCollection,
  req?: Partial<PayloadRequest>,
): Promise<Where> {
  const key = KEY[collection];
  const { enabledIds, groups } = await loadMembersAndGroups(payload, collection, req);
  const quake = quakeMembers(groups, key);
  const readable = new Set([...visibleMemberIds(enabledIds, groups, key), ...enabledIds.filter((id) => quake.has(id))]);
  return idsFilter([...readable]);
}
