import type { Payload, PayloadRequest, Where } from 'payload';

export type VisibilityGroup = {
  is_all?: boolean | null;
  is_quake?: boolean | null;
  visible?: boolean | null;
  slides: number[];
};

/**
 * 有効で、かつ「すべて」が表示中か表示中の通常のグループに属するスライドだけを、元の並びのまま返す。
 * 緊急地震速報のグループの所属は巡回・固定に混ぜないため、「すべて」が表示中でも除く
 */
export function visibleSlideIds(enabledSlideIds: number[], groups: VisibilityGroup[]): number[] {
  const quake = new Set(groups.filter((g) => g.is_quake).flatMap((g) => g.slides));
  const candidates = enabledSlideIds.filter((id) => !quake.has(id));
  if (groups.some((g) => g.is_all && g.visible)) return candidates;
  const members = new Set(groups.filter((g) => !g.is_all && !g.is_quake && g.visible).flatMap((g) => g.slides));
  return candidates.filter((id) => members.has(id));
}

type Reader = Pick<Payload, 'find'>;

type Loaded = { enabledIds: number[]; groups: VisibilityGroup[] };

async function loadSlidesAndGroups(payload: Reader, req?: Partial<PayloadRequest>): Promise<Loaded> {
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
  return {
    enabledIds: slides.docs.map((s) => s.id),
    groups: groups.docs.map((g) => ({
      is_all: g.is_all,
      is_quake: g.is_quake,
      visible: g.visible,
      slides: (g.slides ?? []).map((s) => (typeof s === 'object' ? s.id : s)),
    })),
  };
}

/** 公開判定・固定の選択肢・自動解除が同じ結果を使うよう、DB から表示対象のスライド ID を計算する */
export async function loadVisibleSlideIds(payload: Reader, req?: Partial<PayloadRequest>): Promise<number[]> {
  const { enabledIds, groups } = await loadSlidesAndGroups(payload, req);
  return visibleSlideIds(enabledIds, groups);
}

const noMatch: Where = { id: { exists: false } };

function idsFilter(ids: number[]): Where {
  return ids.length > 0 ? { id: { in: ids } } : noMatch;
}

/**
 * policy.ts は同期でDBを読めないため、公開判定に重ねる表示対象の条件はここで作る。
 * 一致なしは false ではなく存在しない列の条件で表す (false を返すと読み取りが 403 になる)
 */
export async function visibleSlideFilter(payload: Reader, req?: Partial<PayloadRequest>): Promise<Where> {
  return idsFilter(await loadVisibleSlideIds(payload, req));
}

/**
 * 未認証の読み取りの条件。表示対象に加え、緊急地震速報のグループの所属(有効なもの)も読める。
 * スナップショットが段階のスライドを取得するのに必要で、巡回の一覧からはフロント側で除く
 */
export async function publicSlideFilter(payload: Reader, req?: Partial<PayloadRequest>): Promise<Where> {
  const { enabledIds, groups } = await loadSlidesAndGroups(payload, req);
  const quake = new Set(groups.filter((g) => g.is_quake).flatMap((g) => g.slides));
  const readable = new Set([...visibleSlideIds(enabledIds, groups), ...enabledIds.filter((id) => quake.has(id))]);
  return idsFilter([...readable]);
}
