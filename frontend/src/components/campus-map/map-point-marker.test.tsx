import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DivIcon } from 'leaflet';

const markerProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props);
    return <div>{props.children as never}</div>;
  },
  useMapEvents: () => null,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="tooltip">{children}</span>
  ),
}));

import { MapPointMarker, keepTooltipOnTouch } from './map-point-marker';

function iconHtml(): string {
  return ((markerProps.at(-1)!.icon as DivIcon).options as { html: string })
    .html;
}

describe('MapPointMarker', () => {
  it('ごみステーションは緑色のごみ箱形アイコンと吹き出しを持つ', () => {
    render(
      <MapPointMarker
        point={{ id: 1, kind: 'garbage_station', latitude: 36, longitude: 139 }}
      />,
    );
    expect(markerProps.at(-1)!.position).toEqual([36, 139]);
    expect(iconHtml()).toContain('<svg');
    expect(iconHtml()).not.toContain('rounded-full');
    expect(iconHtml()).toContain('aria-label="ごみステーション"');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('ごみステーション');
  });

  it('専用受付をエリアと同じラベルで選択できる', () => {
    const onSelect = vi.fn();
    render(
      <MapPointMarker
        point={{
          id: 3,
          kind: 'reception',
          latitude: 36,
          longitude: 139,
          label: 'ママタルトお笑いライブ専用受付',
        }}
        onSelect={onSelect}
      />,
    );
    expect(iconHtml()).toContain('お笑いライブ受付');
    expect(iconHtml()).toContain('bg-white');
    expect(iconHtml()).toContain('whitespace-nowrap');
    expect(markerProps.at(-1)!.bubblingMouseEvents).toBe(false);
    (markerProps.at(-1)!.eventHandlers as { click: () => void }).click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('受付はエリアと同じ白いラベルを持つ', () => {
    render(
      <MapPointMarker
        point={{ id: 2, kind: 'reception', latitude: 36, longitude: 139 }}
      />,
    );
    expect(iconHtml()).toContain('受付');
    expect(iconHtml()).toContain('bg-white');
    expect(iconHtml()).toContain('rounded-full');
  });

  it('タッチ由来の mouseout は親へ伝えず、マウス由来は伝える', () => {
    const icon = document.createElement('div');
    const inner = document.createElement('span');
    icon.appendChild(inner);
    keepTooltipOnTouch(icon);
    const bubbled = vi.fn();
    document.body.appendChild(icon);
    // Leaflet はマーカー要素の bubble フェーズで購読する
    icon.addEventListener('mouseout', bubbled);
    const out = (type: string) =>
      inner.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    const pointerOut = (pointerType: string) =>
      inner.dispatchEvent(
        Object.assign(new Event('pointerout', { bubbles: true }), {
          pointerType,
        }),
      );

    pointerOut('touch');
    out('mouseout');
    expect(bubbled).not.toHaveBeenCalled();

    pointerOut('mouse');
    out('mouseout');
    expect(bubbled).toHaveBeenCalledTimes(1);
  });
});
