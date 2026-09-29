'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type DivIcon } from 'leaflet';
import { useMemo, useRef } from 'react';
import type { Marker as LeafletMarker } from 'leaflet';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import { MaterialIcon } from '@/components/icons';
import type { CampusMapPoint, CampusMapPointKind } from '@/lib/campus-map';

export interface MapPointMarkerProps {
  readonly point: CampusMapPoint;
}

export const POINT_KIND_META: Record<
  CampusMapPointKind,
  { readonly label: string; readonly icon: string; readonly bgClass: string }
> = {
  garbage_station: {
    label: 'ごみステーション',
    icon: 'delete',
    bgClass: 'bg-success',
  },
  reception: { label: '受付', icon: 'info_i', bgClass: 'bg-info' },
};

const MARKER_SIZE = 28;

// 枠の太さだけがホバーで変わる。border-box の固定サイズなので中身の位置は動かない
export function buildPointIcon(kind: CampusMapPointKind): DivIcon {
  const { label, icon, bgClass } = POINT_KIND_META[kind];
  return divIcon({
    html: renderToStaticMarkup(
      <span
        role="img"
        aria-label={label}
        className={`box-border flex size-7 items-center justify-center rounded-full border border-gray-200 text-text shadow-card hover:border-2 hover:border-text ${bgClass}`}
      >
        <MaterialIcon name={icon} size={18} />
      </span>,
    ),
    className: '',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    // 吹き出しの基準をマーカー上端にする。しっぽ先端との 2px の隙間は
    // globals.css の .map-point-tooltip と offset で作る
    tooltipAnchor: [0, -MARKER_SIZE / 2],
  });
}

// タッチでは pointerup の後に pointerout が来て、Leaflet が mouseout として
// 吹き出しを閉じてしまう。pointerout は mouseout より先に発火するので、
// 種別を控えて touch の mouseout だけ Leaflet の既定ハンドラへ届く前に止める
export function keepTooltipOnTouch(icon: HTMLElement) {
  let touch = false;
  icon.addEventListener(
    'pointerout',
    (e) => {
      touch = e.pointerType === 'touch';
    },
    true,
  );
  icon.addEventListener(
    'mouseout',
    (e) => {
      if (touch) e.stopPropagation();
    },
    true,
  );
}

export function MapPointMarker({ point }: MapPointMarkerProps) {
  const ref = useRef<LeafletMarker>(null);
  const icon = useMemo(() => buildPointIcon(point.kind), [point.kind]);
  // タッチで開いた吹き出しは、地図タップか他マーカーの吹き出しが開くまで残す
  useMapEvents({
    click: () => ref.current?.closeTooltip(),
    tooltipopen: (e) => {
      if (e.tooltip !== ref.current?.getTooltip()) ref.current?.closeTooltip();
    },
  });
  return (
    <Marker
      ref={ref}
      eventHandlers={{
        add: (e) =>
          keepTooltipOnTouch((e.target as LeafletMarker).getElement()!),
      }}
      position={[point.latitude, point.longitude]}
      icon={icon}
    >
      <Tooltip
        direction="top"
        offset={[0, -8]}
        className="map-point-tooltip"
        opacity={1}
      >
        {POINT_KIND_META[point.kind].label}
      </Tooltip>
    </Marker>
  );
}
