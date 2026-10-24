import { describe, expect, it } from 'vitest';

import type { RegionalSponsor } from './regional-sponsors';
import {
  clusterProjectedSponsors,
  createSpiderfyLayout,
} from './regional-sponsor-clustering';

function sponsor(id: number, latitude = id, longitude = id): RegionalSponsor {
  return {
    id,
    name: `テスト専用協賛${id}`,
    category: 'shop',
    latitude,
    longitude,
    address: null,
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    closedDays: null,
    phone: null,
    websiteUrl: null,
    order: id,
  };
}

describe('clusterProjectedSponsors', () => {
  it('近接点を決定的にまとめ、非近接点は単独にする', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(3), x: 220, y: 220 },
        { sponsor: sponsor(2), x: 18, y: 14 },
        { sponsor: sponsor(1), x: 10, y: 10 },
      ],
      { radius: 16, selectedSponsorId: null },
    );

    expect(groups.map((group) => [group.kind, group.id])).toEqual([
      ['cluster', 'cluster:1,2'],
      ['single', 'sponsor:3'],
    ]);
    expect(
      groups[0]?.kind === 'cluster' && groups[0].sponsors.map((s) => s.id),
    ).toEqual([1, 2]);
  });

  it('投影座標が変わればzoom後の分離結果も変わる', () => {
    const close = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1), x: 10, y: 10 },
        { sponsor: sponsor(2), x: 20, y: 20 },
      ],
      { radius: 16, selectedSponsorId: null },
    );
    const separated = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1), x: 10, y: 10 },
        { sponsor: sponsor(2), x: 80, y: 80 },
      ],
      { radius: 16, selectedSponsorId: null },
    );

    expect(close).toHaveLength(1);
    expect(separated).toHaveLength(2);
  });

  it('絞り込み後の入力件数を保ち、選択中店舗をクラスタから分離する', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1), x: 10, y: 10 },
        { sponsor: sponsor(2), x: 11, y: 11 },
        { sponsor: sponsor(3), x: 12, y: 12 },
      ],
      { radius: 16, selectedSponsorId: 2 },
    );

    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.id === 'sponsor:2')).toMatchObject({
      kind: 'single',
      selected: true,
    });
    const represented = groups.reduce(
      (sum, group) =>
        sum + (group.kind === 'single' ? 1 : group.sponsors.length),
      0,
    );
    expect(represented).toBe(3);
  });

  it('全件同一座標を1クラスタにし、全店舗を選べる放射状配置を返す', () => {
    const same = [
      sponsor(3, 36.4, 139.1),
      sponsor(1, 36.4, 139.1),
      sponsor(2, 36.4, 139.1),
    ];
    const groups = clusterProjectedSponsors(
      same.map((item) => ({ sponsor: item, x: 100, y: 100 })),
      { radius: 16, selectedSponsorId: null },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: 'cluster',
      allSameCoordinate: true,
    });

    const layout = createSpiderfyLayout(same, 44);
    expect(layout.map((entry) => entry.sponsor.id)).toEqual([1, 2, 3]);
    expect(
      new Set(layout.map((entry) => `${entry.offsetX},${entry.offsetY}`)).size,
    ).toBe(3);
  });
});
