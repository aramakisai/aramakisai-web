import { describe, expect, it } from 'vitest';

import type { RegionalSponsor } from './regional-sponsors';
import { clusterProjectedSponsors } from './regional-sponsor-clustering';

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
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: null },
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
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: null },
    );
    const separated = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1), x: 10, y: 10 },
        { sponsor: sponsor(2), x: 80, y: 80 },
      ],
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: null },
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
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: 2 },
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

  it('選択中店舗の同一座標グループごと入力から外し、同じ座標の他社は返さない', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1, 36.4, 139.1), x: 100, y: 100 },
        { sponsor: sponsor(2, 36.4, 139.1), x: 100, y: 100 },
        { sponsor: sponsor(3, 36.5, 139.2), x: 105, y: 100 },
      ],
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: 2 },
    );
    expect(groups.map((g) => g.id)).toEqual(['sponsor:2', 'sponsor:3']);
    expect(groups[0]).toMatchObject({ kind: 'single', selected: true });
  });

  it('全件同一座標はどのzoomでも location として返す', () => {
    const same = [
      sponsor(3, 36.4, 139.1),
      sponsor(1, 36.4, 139.1),
      sponsor(2, 36.4, 139.1),
    ];
    for (const zoom of [10, 17, 18]) {
      const groups = clusterProjectedSponsors(
        same.map((item) => ({ sponsor: item, x: 100, y: 100 })),
        { radius: 16, zoom, maxZoom: 17, selectedSponsorId: null },
      );
      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({
        kind: 'location',
        id: 'location:1,2,3',
        anchor: { latitude: 36.4, longitude: 139.1 },
      });
    }
  });

  it('最大zoomでは半径内の座標が異なる企業を location にまとめ、半径外は単独のまま返す', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1, 36.4, 139.1), x: 10, y: 10 },
        { sponsor: sponsor(2, 36.4001, 139.1), x: 14, y: 10 },
        { sponsor: sponsor(3, 36.4002, 139.1), x: 18, y: 10 },
        { sponsor: sponsor(4, 36.5, 139.1), x: 200, y: 10 },
      ],
      { radius: 16, zoom: 17, maxZoom: 17, selectedSponsorId: null },
    );
    expect(groups.map((g) => [g.kind, g.id])).toEqual([
      ['location', 'location:1,2,3'],
      ['single', 'sponsor:4'],
    ]);
    // 平均に最も近い実在の1社(2)の座標にピンの先端を置く
    expect(groups[0]).toMatchObject({
      anchor: { latitude: 36.4001, longitude: 139.1 },
    });
  });

  it('最大zoomの手前では同じ近さでも cluster のまま', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1, 36.4, 139.1), x: 10, y: 10 },
        { sponsor: sponsor(2, 36.4001, 139.1), x: 14, y: 10 },
      ],
      { radius: 16, zoom: 16, maxZoom: 17, selectedSponsorId: null },
    );
    expect(groups.map((g) => g.kind)).toEqual(['cluster']);
  });

  it('cluster の anchor は平均に最も近い1社の座標になる', () => {
    const groups = clusterProjectedSponsors(
      [
        { sponsor: sponsor(1, 0, 0), x: 10, y: 10 },
        { sponsor: sponsor(2, 1, 1), x: 11, y: 10 },
        { sponsor: sponsor(3, 5, 5), x: 12, y: 10 },
      ],
      { radius: 16, zoom: 15, maxZoom: 17, selectedSponsorId: null },
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: 'cluster',
      anchor: { latitude: 1, longitude: 1 },
    });
  });
});
