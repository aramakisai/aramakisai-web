import type { AreaOption } from './exhibitions';
import { groupStampsByArea, type MypageStampTarget } from './stamp-progress';
import type { AllRecords, StampRecord } from './stamp-db';
import type { StampCategory } from './stamp-signature';

export interface AreaCount {
  readonly areaId: number | null;
  readonly areaName: string;
  readonly collected: number;
}

export interface VisitorSummary {
  readonly stampCount: number;
  readonly byArea: readonly AreaCount[];
}

export interface TargetStat {
  readonly exhibitionId: number;
  readonly category: StampCategory;
  readonly displayName: string;
  readonly visitorCount: number;
  readonly rate: number;
}

export interface AreaStat {
  readonly areaId: number | null;
  readonly areaName: string;
  readonly collected: number;
  readonly averagePercent: number | null;
}

export interface Dashboard {
  readonly participantCount: number;
  readonly activeExchangeCount: number;
  readonly targets: readonly TargetStat[];
  readonly areas: readonly AreaStat[];
  readonly distribution: readonly {
    readonly stampCount: number;
    readonly visitorCount: number;
  }[];
}

const UNKNOWN_AREA = 'エリア不明';

const keyOf = (id: number, category: StampCategory) => `${id}:${category}`;

// 対象外 (非公開・カタログに無い) のスタンプは group に現れないので、総数との差がエリア不明になる
function groupVisitor(
  targets: readonly MypageStampTarget[],
  areas: readonly AreaOption[],
  stamps: readonly StampRecord[],
) {
  const grouped = groupStampsByArea(
    targets,
    areas,
    stamps.map((s) => ({
      id: s.exhibitionId,
      category: s.category,
      savedAt: s.acquiredAt,
    })),
  );
  const known = grouped.areas.reduce((n, a) => n + a.collected, 0);
  return { grouped, unknown: stamps.length - known };
}

export function summarizeVisitor(
  targets: readonly MypageStampTarget[],
  areas: readonly AreaOption[],
  stamps: readonly StampRecord[],
): VisitorSummary {
  const { grouped, unknown } = groupVisitor(targets, areas, stamps);
  const byArea: AreaCount[] = grouped.areas
    .filter((a) => a.collected > 0)
    .map((a) => ({
      areaId: a.areaId,
      areaName: a.areaName,
      collected: a.collected,
    }));
  if (unknown > 0)
    byArea.push({ areaId: null, areaName: UNKNOWN_AREA, collected: unknown });
  return { stampCount: stamps.length, byArea };
}

export function isComplete(
  targets: readonly MypageStampTarget[],
  stamps: readonly StampRecord[],
): boolean {
  if (targets.length === 0) return false;
  const have = new Set(stamps.map((s) => keyOf(s.exhibitionId, s.category)));
  return targets.every((t) => have.has(keyOf(t.id, t.category)));
}

export function aggregate(
  targets: readonly MypageStampTarget[],
  areas: readonly AreaOption[],
  records: AllRecords,
): Dashboard {
  const byVisitor = new Map<string, StampRecord[]>();
  for (const s of records.stamps) {
    const list = byVisitor.get(s.visitorId) ?? [];
    list.push(s);
    byVisitor.set(s.visitorId, list);
  }
  const participantCount = byVisitor.size;

  const holders = new Map<string, number>();
  const areaCollected = new Map<number, number>();
  const areaPercentSum = new Map<number, number>();
  const areaMeta = new Map<number, string>();
  let unknownCollected = 0;
  const distribution = new Map<number, number>();

  for (const stamps of byVisitor.values()) {
    for (const s of stamps) {
      const k = keyOf(s.exhibitionId, s.category);
      holders.set(k, (holders.get(k) ?? 0) + 1);
    }
    distribution.set(stamps.length, (distribution.get(stamps.length) ?? 0) + 1);
    const { grouped, unknown } = groupVisitor(targets, areas, stamps);
    unknownCollected += unknown;
    for (const a of grouped.areas) {
      areaMeta.set(a.areaId, a.areaName);
      areaCollected.set(
        a.areaId,
        (areaCollected.get(a.areaId) ?? 0) + a.collected,
      );
      areaPercentSum.set(
        a.areaId,
        (areaPercentSum.get(a.areaId) ?? 0) + a.percent,
      );
    }
  }

  const memberAreas = new Set(
    targets.flatMap((t) => (t.areaId === null ? [] : [t.areaId])),
  );
  const areaStats: AreaStat[] = areas
    .filter((a) => memberAreas.has(a.id))
    .map((a) => ({
      areaId: a.id,
      areaName: a.name,
      collected: areaCollected.get(a.id) ?? 0,
      averagePercent:
        participantCount === 0
          ? 0
          : Math.round((areaPercentSum.get(a.id) ?? 0) / participantCount),
    }));
  if (unknownCollected > 0)
    areaStats.push({
      areaId: null,
      areaName: UNKNOWN_AREA,
      collected: unknownCollected,
      averagePercent: null,
    });

  return {
    participantCount,
    activeExchangeCount: records.activeExchangeCount,
    targets: targets.map((t) => {
      const visitorCount = holders.get(keyOf(t.id, t.category)) ?? 0;
      return {
        exhibitionId: t.id,
        category: t.category,
        displayName: t.displayName,
        visitorCount,
        rate: participantCount === 0 ? 0 : visitorCount / participantCount,
      };
    }),
    areas: areaStats,
    distribution: [...distribution]
      .sort((a, b) => a[0] - b[0])
      .map(([stampCount, visitorCount]) => ({ stampCount, visitorCount })),
  };
}
