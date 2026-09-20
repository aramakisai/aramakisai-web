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

import { AreaPin } from './area-pin';

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

const OTHER_GEOMETRY: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [139.01, 36.44],
      [139.011, 36.44],
      [139.011, 36.441],
      [139.01, 36.441],
      [139.01, 36.44],
    ],
  ],
};

function lastIconHtml(): string {
  const icon = markerProps.at(-1)!.icon as DivIcon;
  return (icon.options as { html: string }).html;
}

describe('AreaPin', () => {
  it('区画の重心にピンを配置する', () => {
    render(<AreaPin geometry={GEOMETRY} />);
    const [latitude, longitude] = polygonCentroid(GEOMETRY);
    expect(markerProps.at(-1)!.position).toEqual([latitude, longitude]);
  });

  it('AreaLabelMarker と同じ divIcon 方式でマーカーを組み立てる', () => {
    render(<AreaPin geometry={GEOMETRY} />);
    const icon = markerProps.at(-1)!.icon as DivIcon;
    expect(icon.options.iconSize).toEqual([0, 0]);
    expect(lastIconHtml()).toContain('icon-location-pin');
  });

  it('accent のカラートークンで着色する', () => {
    render(<AreaPin geometry={GEOMETRY} />);
    expect(lastIconHtml()).toContain('text-accent');
  });

  it('地図に重なっても判別できる寸法をブレークポイントごとに指定する (Figma実測: SP 32px / PC 48px)', () => {
    render(<AreaPin geometry={GEOMETRY} />);
    const html = lastIconHtml();
    expect(html).toContain('width="32"');
    expect(html).toContain('md:w-12');
    expect(html).toContain('md:h-12');
  });

  it('size を指定した場合はその寸法をブレークポイントによらず用いる', () => {
    render(<AreaPin geometry={GEOMETRY} size={40} />);
    const html = lastIconHtml();
    expect(html).toContain('width="40"');
    expect(html).not.toContain('md:w-12');
  });

  it('ピン自身はクリックを受け取らない (ポリゴン側に通す)', () => {
    render(<AreaPin geometry={GEOMETRY} />);
    expect(markerProps.at(-1)!.interactive).toBe(false);
  });

  it('対象エリアが複数あるとき、そのすべてにピンが描画される', () => {
    markerProps.length = 0;
    render(
      <>
        <AreaPin geometry={GEOMETRY} />
        <AreaPin geometry={OTHER_GEOMETRY} />
      </>,
    );
    expect(markerProps).toHaveLength(2);
    const [firstLat, firstLon] = polygonCentroid(GEOMETRY);
    const [secondLat, secondLon] = polygonCentroid(OTHER_GEOMETRY);
    expect(markerProps[0]!.position).toEqual([firstLat, firstLon]);
    expect(markerProps[1]!.position).toEqual([secondLat, secondLon]);
  });
});
