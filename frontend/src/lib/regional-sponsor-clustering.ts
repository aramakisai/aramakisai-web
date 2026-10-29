import type { RegionalSponsor } from './regional-sponsors';

export interface ProjectedSponsor {
  readonly sponsor: RegionalSponsor;
  readonly x: number;
  readonly y: number;
}

export type MarkerGroup =
  | {
      readonly kind: 'single';
      readonly id: string;
      readonly sponsor: RegionalSponsor;
      readonly selected: boolean;
    }
  | {
      readonly kind: 'cluster' | 'location';
      readonly id: string;
      readonly sponsors: readonly RegionalSponsor[];
      readonly anchor: {
        readonly latitude: number;
        readonly longitude: number;
      };
    };

interface ClusterOptions {
  readonly radius: number;
  readonly zoom: number;
  readonly maxZoom: number;
  readonly selectedSponsorId: number | null;
}

export function coordinateKey(sponsor: {
  readonly latitude: number;
  readonly longitude: number;
}): string {
  return `${sponsor.latitude}:${sponsor.longitude}`;
}

/** 地点のまとまりの識別子。まとまりは座標の完全一致ではなく画面上の近さで決まるため企業IDで表す */
export function locationIdsOf(
  sponsors: readonly { readonly id: number }[],
): readonly number[] {
  return sponsors.map(({ id }) => id).sort((a, b) => a - b);
}

interface CoordinateGroup {
  readonly key: string;
  readonly sponsors: RegionalSponsor[];
  readonly x: number;
  readonly y: number;
}

function firstId(group: MarkerGroup): number {
  return group.kind === 'single' ? group.sponsor.id : group.sponsors[0]!.id;
}

/** 平均座標に最も近い1社の座標。実在しない地点を指さないため */
function nearestToMean(sponsors: readonly RegionalSponsor[]) {
  const latitude =
    sponsors.reduce((sum, s) => sum + s.latitude, 0) / sponsors.length;
  const longitude =
    sponsors.reduce((sum, s) => sum + s.longitude, 0) / sponsors.length;
  let best = sponsors[0]!;
  let bestDistance = Infinity;
  for (const s of sponsors) {
    const distance = Math.hypot(s.latitude - latitude, s.longitude - longitude);
    if (distance < bestDistance) {
      best = s;
      bestDistance = distance;
    }
  }
  return { latitude: best.latitude, longitude: best.longitude };
}

export function clusterProjectedSponsors(
  projectedSponsors: readonly ProjectedSponsor[],
  { radius, zoom, maxZoom, selectedSponsorId }: ClusterOptions,
): readonly MarkerGroup[] {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('クラスタ半径は正の有限値である必要があります');
  }

  const selected = projectedSponsors.find(
    ({ sponsor }) => sponsor.id === selectedSponsorId,
  );
  const selectedKey = selected ? coordinateKey(selected.sponsor) : null;

  const byCoordinate = new Map<string, CoordinateGroup>();
  for (const { sponsor, x, y } of projectedSponsors
    .slice()
    .sort((a, b) => a.sponsor.id - b.sponsor.id)) {
    const key = coordinateKey(sponsor);
    if (key === selectedKey) continue;
    const group = byCoordinate.get(key);
    if (group) group.sponsors.push(sponsor);
    else byCoordinate.set(key, { key, sponsors: [sponsor], x, y });
  }
  const points = [...byCoordinate.values()];
  const parent = points.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[index] !== index) {
      const next = parent[index]!;
      parent[index] = root;
      index = next;
    }
    return root;
  };

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    for (let otherIndex = 0; otherIndex < index; otherIndex += 1) {
      const other = points[otherIndex]!;
      if (Math.hypot(point.x - other.x, point.y - other.y) <= radius) {
        const rootA = find(index);
        const rootB = find(otherIndex);
        if (rootA !== rootB)
          parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
      }
    }
  }

  const grouped = new Map<number, CoordinateGroup[]>();
  for (let index = 0; index < points.length; index += 1) {
    const root = find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), points[index]!]);
  }

  const groups: MarkerGroup[] = [...grouped.values()].map((members) => {
    const sponsors = members
      .flatMap((member) => member.sponsors)
      .sort((a, b) => a.id - b.id);
    if (sponsors.length === 1) {
      return {
        kind: 'single',
        id: `sponsor:${sponsors[0]!.id}`,
        sponsor: sponsors[0]!,
        selected: false,
      };
    }
    // 最大 zoom ではこれ以上寄れないため、近い企業はクラスタでなく地点の一覧にまとめる
    const kind =
      members.length === 1 || zoom >= maxZoom ? 'location' : 'cluster';
    return {
      kind,
      id: `${kind}:${locationIdsOf(sponsors).join(',')}`,
      sponsors,
      anchor: nearestToMean(sponsors),
    };
  });

  if (selected) {
    groups.push({
      kind: 'single',
      id: `sponsor:${selected.sponsor.id}`,
      sponsor: selected.sponsor,
      selected: true,
    });
  }
  return groups.sort((a, b) => firstId(a) - firstId(b));
}
