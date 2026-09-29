import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DivIcon } from 'leaflet';
import type { MultiPolygonGeometry } from '@/lib/campus-map-geometry';
import { polygonCentroid } from '@/lib/campus-map-geometry';

const markerProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div data-testid="marker" />;
  },
}));

import { AreaLabelMarker } from './area-label-marker';

const GEOMETRY: MultiPolygonGeometry = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [139.0, 36.43],
        [139.001, 36.43],
        [139.001, 36.431],
        [139.0, 36.431],
        [139.0, 36.43],
      ],
    ],
  ],
};

function lastIconHtml(): string {
  const icon = markerProps.at(-1)!.icon as DivIcon;
  return (icon.options as { html: string }).html;
}

describe('AreaLabelMarker', () => {
  it('ポリゴンの重心にラベルを配置する', () => {
    render(
      <AreaLabelMarker name="Aゾーン" geometry={GEOMETRY} selected={false} />,
    );
    const [latitude, longitude] = polygonCentroid(GEOMETRY);
    expect(markerProps.at(-1)!.position).toEqual([latitude, longitude]);
  });

  it('エリア名をラベルの文字列として描画する', () => {
    render(
      <AreaLabelMarker name="Aゾーン" geometry={GEOMETRY} selected={false} />,
    );
    expect(lastIconHtml()).toContain('Aゾーン');
  });

  it('CMS 由来のエリア名を HTML としてではなく文字列としてエスケープする', () => {
    render(
      <AreaLabelMarker
        name={'<script>alert(1)</script>'}
        geometry={GEOMETRY}
        selected={false}
      />,
    );
    expect(lastIconHtml()).not.toContain('<script>');
    expect(lastIconHtml()).toContain('&lt;script&gt;');
  });

  it('通常時は白背景のラベルにする', () => {
    render(
      <AreaLabelMarker name="Aゾーン" geometry={GEOMETRY} selected={false} />,
    );
    expect(lastIconHtml()).toContain('bg-white');
  });

  it('選択中は選択中の表現 (primary 背景) に切り替える', () => {
    render(
      <AreaLabelMarker name="Aゾーン" geometry={GEOMETRY} selected={true} />,
    );
    expect(lastIconHtml()).toContain('bg-primary');
    expect(lastIconHtml()).not.toContain('bg-white');
  });

  it('ラベル自身はクリックを受け取らない (ポリゴン側に通す)', () => {
    render(
      <AreaLabelMarker name="Aゾーン" geometry={GEOMETRY} selected={false} />,
    );
    expect(markerProps.at(-1)!.interactive).toBe(false);
  });

  it('複数ポリゴンを持つエリアでは、面積が最大のポリゴンの重心にラベルを 1 個だけ配置する', () => {
    const multiPolygon: MultiPolygonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        // 小さいポリゴン
        [
          [
            [139.0, 36.43],
            [139.001, 36.43],
            [139.001, 36.431],
            [139.0, 36.431],
            [139.0, 36.43],
          ],
        ],
        // 大きいポリゴン
        [
          [
            [140.0, 37.0],
            [140.0, 37.1],
            [140.1, 37.1],
            [140.1, 37.0],
            [140.0, 37.0],
          ],
        ],
      ],
    };

    markerProps.length = 0;
    render(
      <AreaLabelMarker
        name="Aゾーン"
        geometry={multiPolygon}
        selected={false}
      />,
    );

    // 1 エリア = 1 ラベル (Marker は 1 回だけ描画される)
    expect(markerProps).toHaveLength(1);
    const [latitude, longitude] = polygonCentroid(multiPolygon);
    expect(markerProps.at(-1)!.position).toEqual([latitude, longitude]);
    expect(longitude).toBeCloseTo(140.05, 5);
    expect(latitude).toBeCloseTo(37.05, 5);
  });
});
