'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type DivIcon } from 'leaflet';
import { useMemo, useRef } from 'react';
import type { Marker as LeafletMarker } from 'leaflet';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import type { CampusMapPoint, CampusMapPointKind } from '@/lib/campus-map';
import { buildLabelIcon } from './area-label-marker';

export interface MapPointMarkerProps {
  readonly point: CampusMapPoint;
  readonly selected?: boolean;
  readonly onSelect?: (point: CampusMapPoint) => void;
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
export function buildPointIcon(
  kind: CampusMapPointKind,
  label = POINT_KIND_META[kind].label,
  selected = false,
): DivIcon {
  if (kind === 'reception')
    return buildLabelIcon(label, selected, false, false);
  return divIcon({
    html: renderToStaticMarkup(
      <span role="img" aria-label={label}>
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path
            d="M10 2.5h8l1 2.5h5v3H4V5h5zM6 9.5h16l-1.5 16h-13z"
            fill="#56863c"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M11 13v8m6-8v8"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
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

export function MapPointMarker({
  point,
  selected = false,
  onSelect,
}: MapPointMarkerProps) {
  const ref = useRef<LeafletMarker>(null);
  const label =
    point.kind === 'reception'
      ? point.receptionType === 'comedy' ||
        point.label?.includes('お笑いライブ')
        ? 'お笑いライブ受付'
        : '受付'
      : POINT_KIND_META[point.kind].label;
  const icon = useMemo(
    () => buildPointIcon(point.kind, label, selected),
    [point.kind, label, selected],
  );
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
        click: () => {
          if (point.kind === 'reception') onSelect?.(point);
        },
      }}
      bubblingMouseEvents={false}
      position={[point.latitude, point.longitude]}
      title={label}
      icon={icon}
    >
      {(point.kind === 'garbage_station' || !onSelect) && (
        <Tooltip
          direction="top"
          offset={[0, -8]}
          className="map-point-tooltip"
          opacity={1}
        >
          {label}
        </Tooltip>
      )}
    </Marker>
  );
}
