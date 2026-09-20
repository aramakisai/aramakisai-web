import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DivIcon } from 'leaflet';
import type { PolygonGeometry } from '@/lib/campus-map-geometry';
import { polygonCentroid } from '@/lib/campus-map-geometry';

const markerProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div data-testid="marker" />;
  },
}));

import { AreaLabelMarker } from './area-label-marker';

const GEOMETRY: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [139.0, 36.43],
      [139.001, 36.43],
      [139.001, 36.431],
      [139.0, 36.431],
      [139.0, 36.43],
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
});
