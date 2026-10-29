import type { AreaOption } from './exhibitions';
import type { SavedExhibitionRef } from './mypage-storage';
import type { StampCategory } from './stamp-signature';

export interface MypageStampTarget {
  readonly id: number;
  readonly category: StampCategory;
  readonly displayName: string;
  readonly organizationName: string;
  readonly areaId: number | null;
}

export interface CollectedStamp {
  readonly id: number;
  readonly category: StampCategory;
  readonly displayName: string;
  readonly savedAt: string;
}

export interface AreaStampGroup {
  readonly areaId: number;
  readonly areaName: string;
  readonly total: number;
  readonly collected: number;
  readonly percent: number;
  readonly stamps: readonly CollectedStamp[];
}

export interface GroupedStamps {
  readonly areas: readonly AreaStampGroup[];
  readonly others: readonly CollectedStamp[];
}

const keyOf = (id: number, category: StampCategory) => `${id}:${category}`;

export function groupStampsByArea(
  targets: readonly MypageStampTarget[],
  areas: readonly AreaOption[],
  stamps: readonly SavedExhibitionRef[],
): GroupedStamps {
  const savedAtByKey = new Map(
    stamps.map((s) => [keyOf(s.id, s.category), s.savedAt]),
  );
  const newestFirst = (a: CollectedStamp, b: CollectedStamp) =>
    b.savedAt.localeCompare(a.savedAt);

  const byArea = new Map<number, MypageStampTarget[]>();
  const collectedOthers: CollectedStamp[] = [];
  for (const target of targets) {
    if (target.areaId === null) {
      const savedAt = savedAtByKey.get(keyOf(target.id, target.category));
      if (savedAt !== undefined) collectedOthers.push({ ...target, savedAt });
      continue;
    }
    const list = byArea.get(target.areaId) ?? [];
    list.push(target);
    byArea.set(target.areaId, list);
  }

  const groups: AreaStampGroup[] = [];
  for (const area of areas) {
    const members = byArea.get(area.id);
    if (!members) continue;
    const collected: CollectedStamp[] = [];
    for (const m of members) {
      const savedAt = savedAtByKey.get(keyOf(m.id, m.category));
      if (savedAt !== undefined) collected.push({ ...m, savedAt });
    }
    groups.push({
      areaId: area.id,
      areaName: area.name,
      total: members.length,
      collected: collected.length,
      percent: Math.floor((collected.length / members.length) * 100),
      stamps: collected.sort(newestFirst),
    });
  }
  return { areas: groups, others: collectedOthers.sort(newestFirst) };
}
