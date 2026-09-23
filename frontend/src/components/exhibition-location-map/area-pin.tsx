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
// Material Symbols Sharp の location_on (FILL 1) はフォントの外形データ上、字形の下端が
// ベースラインより上にある (line-height:1 の行送りの下端との間に約 10.4% 分の空白が残る)。
// そのまま -translate-y-full だけだと先端が重心の少し上に浮くため、字形の高さの
// 約 10.4% 分だけ余分に下へ寄せて先端を重心に合わせる
const PIN_ICON_SIZE: [number, number] = [0, 0];

// Figma 実測: SP (95:12 内 MapPin 101:304) は 32px、PC (95:2 内 MapPin 101:302) は 48px。
// LocationPinIcon (icons.tsx) は size を fontSize として inline style で描画するため、
// ブレークポイントで上書きするクラスは important 修飾が無いと inline style に負けて効かない
const DEFAULT_PIN_SIZE = 32;
const DEFAULT_PIN_MD_CLASS = 'md:text-[48px]! md:leading-[48px]!';

function buildPinIcon(size?: number): DivIcon {
  return divIcon({
    html: renderToStaticMarkup(
      <span className="-translate-x-1/2 -translate-y-[89.58%] block">
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
