import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DivIcon } from 'leaflet';

const markerProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div>{props.children as never}</div>;
  },
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip">{children}</span>
  ),
}));

import { MapPointMarker } from './map-point-marker';

function iconHtml(): string {
  return ((markerProps.at(-1)!.icon as DivIcon).options as { html: string })
    .html;
}

describe('MapPointMarker', () => {
  it('ごみステーションは delete アイコンと success 色、吹き出し文言を持つ', () => {
    render(
      <MapPointMarker
        point={{ id: 1, kind: 'garbage_station', latitude: 36, longitude: 139 }}
      />,
    );
    expect(markerProps.at(-1)!.position).toEqual([36, 139]);
    expect(iconHtml()).toContain('>delete<');
    expect(iconHtml()).toContain('bg-success');
    expect(iconHtml()).toContain('aria-label="ごみステーション"');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('ごみステーション');
  });

  it('受付は info_i アイコンと info 色を持つ', () => {
    render(
      <MapPointMarker
        point={{ id: 2, kind: 'reception', latitude: 36, longitude: 139 }}
      />,
    );
    expect(iconHtml()).toContain('>info_i<');
    expect(iconHtml()).toContain('bg-info');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('受付');
  });
});
