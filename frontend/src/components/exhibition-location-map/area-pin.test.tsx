import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DivIcon } from 'leaflet';
import type { PolygonCoordinates } from '@/lib/campus-map-geometry';
import { singlePolygonCentroid } from '@/lib/campus-map-geometry';

const markerProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div data-testid="marker" />;
  },
}));

import { AreaPin } from './area-pin';

const POLYGON: PolygonCoordinates = [
  [
    [139.0, 36.43],
    [139.001, 36.43],
    [139.001, 36.431],
    [139.0, 36.431],
    [139.0, 36.43],
  ],
];

const OTHER_POLYGON: PolygonCoordinates = [
  [
    [139.01, 36.44],
    [139.011, 36.44],
    [139.011, 36.441],
    [139.01, 36.441],
    [139.01, 36.44],
  ],
];

function lastIconHtml(): string {
  const icon = markerProps.at(-1)!.icon as DivIcon;
  return (icon.options as { html: string }).html;
}

describe('AreaPin', () => {
  it('ポリゴンの重心にピンを配置する', () => {
    render(<AreaPin polygon={POLYGON} />);
    const [latitude, longitude] = singlePolygonCentroid(POLYGON);
    expect(markerProps.at(-1)!.position).toEqual([latitude, longitude]);
  });

  it('AreaLabelMarker と同じ divIcon 方式でマーカーを組み立てる', () => {
    render(<AreaPin polygon={POLYGON} />);
    const icon = markerProps.at(-1)!.icon as DivIcon;
    expect(icon.options.iconSize).toEqual([0, 0]);
    expect(lastIconHtml()).toContain('icon-location-pin');
  });

  it('accent のカラートークンで着色する', () => {
    render(<AreaPin polygon={POLYGON} />);
    expect(lastIconHtml()).toContain('text-accent');
  });

  it('地図に重なっても判別できる寸法をブレークポイントごとに指定する (Figma実測: SP 32px / PC 48px)', () => {
    render(<AreaPin polygon={POLYGON} />);
    const html = lastIconHtml();
    expect(html).toContain('font-size:32px');
    expect(html).toContain('md:text-[48px]!');
    expect(html).toContain('md:leading-[48px]!');
  });

  it('size を指定した場合はその寸法をブレークポイントによらず用いる', () => {
    render(<AreaPin polygon={POLYGON} size={40} />);
    const html = lastIconHtml();
    expect(html).toContain('font-size:40px');
    expect(html).not.toContain('md:text-[48px]!');
  });

  it('ピン自身はクリックを受け取らない (ポリゴン側に通す)', () => {
    render(<AreaPin polygon={POLYGON} />);
    expect(markerProps.at(-1)!.interactive).toBe(false);
  });

  it('複数のポリゴンを渡すと、そのすべてにピンが描画される (1エリア複数ポリゴンでのポリゴンごとのピン)', () => {
    markerProps.length = 0;
    render(
      <>
        <AreaPin polygon={POLYGON} />
        <AreaPin polygon={OTHER_POLYGON} />
      </>,
    );
    expect(markerProps).toHaveLength(2);
    const [firstLat, firstLon] = singlePolygonCentroid(POLYGON);
    const [secondLat, secondLon] = singlePolygonCentroid(OTHER_POLYGON);
    expect(markerProps[0]!.position).toEqual([firstLat, firstLon]);
    expect(markerProps[1]!.position).toEqual([secondLat, secondLon]);
  });
});
