import type { Payload, PayloadRequest, Where } from 'payload';

type MemberKey = 'slides' | 'telops';
type MemberCollection = 'signage_slides' | 'telops';

export type VisibilityGroup = {
  is_all?: boolean | null;
  visible?: boolean | null;
  slides: number[];
  telops: number[];
};

const KEY: Record<MemberCollection, MemberKey> = { signage_slides: 'slides', telops: 'telops' };

/** 「すべて」が表示中なら有効な全件、そうでなければ表示中の通常グループの所属だけを、元の並びのまま返す */
export function visibleMemberIds(enabledIds: number[], groups: VisibilityGroup[], key: MemberKey): number[] {
  if (groups.some((g) => g.is_all && g.visible)) return enabledIds;
  const members = new Set(groups.filter((g) => !g.is_all && g.visible).flatMap((g) => g[key]));
  return enabledIds.filter((id) => members.has(id));
}

type Reader = Pick<Payload, 'find'>;

const idsOf = (refs: unknown): number[] =>
  (Array.isArray(refs) ? refs : []).map((r) => (typeof r === 'object' && r !== null ? (r as { id: number }).id : r));

/** 公開判定・固定の選択肢・自動解除が同じ結果を使うよう、DB から表示対象のIDを計算する */
export async function loadVisibleIds(
  payload: Reader,
  collection: MemberCollection,
  req?: Partial<PayloadRequest>,
): Promise<number[]> {
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
  return visibleMemberIds(
    members.docs.map((m) => m.id),
    groups.docs.map((g) => ({
      is_all: g.is_all,
      visible: g.visible,
      slides: idsOf(g.slides),
      telops: idsOf(g.telops),
    })),
    KEY[collection],
  );
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
  const ids = await loadVisibleIds(payload, collection, req);
  return ids.length > 0 ? { id: { in: ids } } : { id: { exists: false } };
}
