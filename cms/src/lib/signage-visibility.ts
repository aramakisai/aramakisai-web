import type { Payload, PayloadRequest, Where } from 'payload';

export type VisibilityGroup = { is_all?: boolean | null; visible?: boolean | null; slides: number[] };

/** 有効で、かつ「すべて」が表示中か表示中の通常のグループに属するスライドだけを、元の並びのまま返す */
export function visibleSlideIds(enabledSlideIds: number[], groups: VisibilityGroup[]): number[] {
  if (groups.some((g) => g.is_all && g.visible)) return enabledSlideIds;
  const members = new Set(groups.filter((g) => !g.is_all && g.visible).flatMap((g) => g.slides));
  return enabledSlideIds.filter((id) => members.has(id));
}

type Reader = Pick<Payload, 'find'>;

/** 公開判定・固定の選択肢・自動解除が同じ結果を使うよう、DB から表示対象のスライド ID を計算する */
export async function loadVisibleSlideIds(payload: Reader, req?: Partial<PayloadRequest>): Promise<number[]> {
  const [slides, groups] = await Promise.all([
    payload.find({
      collection: 'signage_slides',
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
  return visibleSlideIds(
    slides.docs.map((s) => s.id),
    groups.docs.map((g) => ({
      is_all: g.is_all,
      visible: g.visible,
      slides: (g.slides ?? []).map((s) => (typeof s === 'object' ? s.id : s)),
    })),
  );
}

/**
 * policy.ts は同期でDBを読めないため、公開判定に重ねる表示対象の条件はここで作る。
 * 一致なしは false ではなく存在しない列の条件で表す (false を返すと読み取りが 403 になる)
 */
export async function visibleSlideFilter(payload: Reader, req?: Partial<PayloadRequest>): Promise<Where> {
  const ids = await loadVisibleSlideIds(payload, req);
  return ids.length > 0 ? { id: { in: ids } } : { id: { exists: false } };
}
