'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type DivIcon } from 'leaflet';
import { Marker } from 'react-leaflet';
import {
  polygonCentroid,
  type PolygonGeometry,
} from '@/lib/campus-map-geometry';

export interface AreaLabelMarkerProps {
  readonly name: string;
  readonly geometry: PolygonGeometry;
  readonly selected: boolean;
}

// 不透明な背景にすることで、7 色いずれの塗り色にも、地図タイルの絵柄にも
// 依存せず判読できる (要件 6.6)。選択中は primary で塗り、文字色は据え置く
// (primary は明度が高く白文字だと基準を満たさないため)。
const DEFAULT_LABEL_CLASS =
  'inline-block whitespace-nowrap rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-text shadow';
const SELECTED_LABEL_CLASS =
  'inline-block whitespace-nowrap rounded-full border-2 border-primary bg-primary px-2 py-0.5 text-xs font-semibold text-text shadow';

// iconSize を [0, 0] にし、中身をその点に対して transform で中央寄せすることで、
// エリア名の文字数に応じた可変幅のラベルを崩さず重心へ配置できる
const LABEL_ICON_SIZE: [number, number] = [0, 0];

function buildLabelIcon(name: string, selected: boolean): DivIcon {
  return divIcon({
    // renderToStaticMarkup を通すことで、CMS 由来のエリア名を React 既定のエスケープで
    // HTML 化する (design.md のセキュリティ上の要求)
    html: renderToStaticMarkup(
      <span
        className={`-translate-x-1/2 -translate-y-1/2 ${
          selected ? SELECTED_LABEL_CLASS : DEFAULT_LABEL_CLASS
        }`}
      >
        {name}
      </span>,
    ),
    className: '',
    iconSize: LABEL_ICON_SIZE,
  });
}

export function AreaLabelMarker({
  name,
  geometry,
  selected,
}: AreaLabelMarkerProps) {
  const [latitude, longitude] = polygonCentroid(geometry);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={buildLabelIcon(name, selected)}
      // クリックの購読はポリゴン側が担う。ラベルが前面にあるためポインタイベントを
      // 素通りさせないと、ラベルに重なった部分だけ選択できなくなる
      interactive={false}
    />
  );
}
