'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type DivIcon } from 'leaflet';
import { Marker } from 'react-leaflet';
import {
  polygonCentroid,
  type PolygonGeometry,
} from '@/lib/campus-map-geometry';
import { LocationPinIcon } from '@/components/icons';

export interface AreaPinProps {
  readonly geometry: PolygonGeometry;
  /** 地図上で判別できる寸法。既定値はコンポーネント内で定める */
  readonly size?: number;
}

// iconSize を [0, 0] にするのは AreaLabelMarker と同じ理由 (中身を transform で位置合わせする)。
// ラベルは中心配置だが、ピンは先端が重心を指す必要があるため、水平は中央・垂直は下端を基準にする。
// LocationPinIcon の図形は viewBox の下端付近に先端を持つ (icons.tsx の形状データで確認済み)
const PIN_ICON_SIZE: [number, number] = [0, 0];

// Figma 実測: SP (95:12 内 MapPin 101:304) は 32px、PC (95:2 内 MapPin 101:302) は 48px。
// 両ブレークポイントの値を Tailwind の標準スケールがそのまま表せる (w-8/w-12) ため、
// カスタム size が渡されない既定時はこの実測値を使う
const DEFAULT_PIN_SIZE = 32;
const DEFAULT_PIN_MD_CLASS = 'md:w-12 md:h-12';

function buildPinIcon(size?: number): DivIcon {
  return divIcon({
    html: renderToStaticMarkup(
      <span className="-translate-x-1/2 -translate-y-full block">
        <LocationPinIcon
          size={size ?? DEFAULT_PIN_SIZE}
          className={`text-accent${
            size === undefined ? ` ${DEFAULT_PIN_MD_CLASS}` : ''
          }`}
        />
      </span>,
    ),
    className: '',
    iconSize: PIN_ICON_SIZE,
  });
}

export function AreaPin({ geometry, size }: AreaPinProps) {
  const [latitude, longitude] = polygonCentroid(geometry);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={buildPinIcon(size)}
      // クリックの購読はポリゴン側が担う。AreaLabelMarker と同じ理由でポインタイベントを素通りさせる
      interactive={false}
    />
  );
}
