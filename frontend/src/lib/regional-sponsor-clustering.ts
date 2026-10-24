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
      readonly kind: 'cluster';
      readonly id: string;
      readonly sponsors: readonly RegionalSponsor[];
      readonly anchor: {
        readonly latitude: number;
        readonly longitude: number;
      };
      readonly allSameCoordinate: boolean;
    };

export interface SpiderfiedSponsor {
  readonly sponsor: RegionalSponsor;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface ClusterOptions {
  readonly radius: number;
  readonly selectedSponsorId: number | null;
}

function coordinateKey(sponsor: RegionalSponsor): string {
  return `${sponsor.latitude}:${sponsor.longitude}`;
}

export function clusterProjectedSponsors(
  projectedSponsors: readonly ProjectedSponsor[],
  { radius, selectedSponsorId }: ClusterOptions,
): readonly MarkerGroup[] {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('クラスタ半径は正の有限値である必要があります');
  }

  const selected = projectedSponsors.find(
    ({ sponsor }) => sponsor.id === selectedSponsorId,
  );
  const points = projectedSponsors
    .filter(({ sponsor }) => sponsor.id !== selectedSponsorId)
    .slice()
    .sort((a, b) => a.sponsor.id - b.sponsor.id);
  const parent = points.map((_, index) => index);
  const cellSize = radius;
  const cells = new Map<string, number[]>();

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
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB)
      parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
  };

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      for (let y = cellY - 1; y <= cellY + 1; y += 1) {
        for (const otherIndex of cells.get(`${x}:${y}`) ?? []) {
          const other = points[otherIndex]!;
          if (Math.hypot(point.x - other.x, point.y - other.y) <= radius) {
            union(index, otherIndex);
          }
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  }

  const grouped = new Map<number, ProjectedSponsor[]>();
  for (let index = 0; index < points.length; index += 1) {
    const root = find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), points[index]!]);
  }

  const groups: MarkerGroup[] = [...grouped.values()].map((members) => {
    const sponsors = members.map(({ sponsor }) => sponsor);
    if (sponsors.length === 1) {
      return {
        kind: 'single',
        id: `sponsor:${sponsors[0]!.id}`,
        sponsor: sponsors[0]!,
        selected: false,
      };
    }
    return {
      kind: 'cluster',
      id: `cluster:${sponsors.map(({ id }) => id).join(',')}`,
      sponsors,
      anchor: {
        latitude:
          sponsors.reduce((sum, sponsor) => sum + sponsor.latitude, 0) /
          sponsors.length,
        longitude:
          sponsors.reduce((sum, sponsor) => sum + sponsor.longitude, 0) /
          sponsors.length,
      },
      allSameCoordinate: new Set(sponsors.map(coordinateKey)).size === 1,
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
  return groups.sort((a, b) => {
    const firstA = a.kind === 'single' ? a.sponsor.id : a.sponsors[0]!.id;
    const firstB = b.kind === 'single' ? b.sponsor.id : b.sponsors[0]!.id;
    return firstA - firstB;
  });
}

export function createSpiderfyLayout(
  sponsors: readonly RegionalSponsor[],
  radius: number,
): readonly SpiderfiedSponsor[] {
  return sponsors
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((sponsor, index, all) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / all.length;
      return {
        sponsor,
        offsetX: Math.round(Math.cos(angle) * radius * 1000) / 1000,
        offsetY: Math.round(Math.sin(angle) * radius * 1000) / 1000,
      };
    });
}
