'use client';

import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, type DivIcon } from 'leaflet';
import { Marker } from 'react-leaflet';
import { MaterialIcon } from '@/components/icons';
import {
  polygonCentroid,
  type MultiPolygonGeometry,
} from '@/lib/campus-map-geometry';

export interface AreaLabelMarkerProps {
  readonly name: string;
  readonly geometry: MultiPolygonGeometry;
  readonly selected: boolean;
  readonly onSelect?: () => void;
  readonly hasAed?: boolean;
  readonly hasToilet?: boolean;
}

// 不透明な背景にすることで、7 色いずれの塗り色にも、地図タイルの絵柄にも
// 依存せず判読できる (要件 6.6)。選択中は primary で塗り、文字色は据え置く
// (primary は明度が高く白文字だと基準を満たさないため)。
const DEFAULT_LABEL_CLASS =
  'inline-flex items-center gap-[3px] whitespace-nowrap rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-text shadow';
const SELECTED_LABEL_CLASS =
  'inline-flex items-center gap-[3px] whitespace-nowrap rounded-full border-2 border-primary bg-primary px-2 py-0.5 text-xs font-semibold text-text shadow';

// iconSize を [0, 0] にし、中身をその点に対して transform で中央寄せすることで、
// エリア名の文字数に応じた可変幅のラベルを崩さず重心へ配置できる
const LABEL_ICON_SIZE: [number, number] = [0, 0];

function buildLabelIcon(
  name: string,
  selected: boolean,
  hasAed: boolean,
  hasToilet: boolean,
): DivIcon {
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
        {hasAed && <MaterialIcon name="ecg_heart" size={14} />}
        {hasToilet && <MaterialIcon name="wc" size={14} />}
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
  onSelect,
  hasAed = false,
  hasToilet = false,
}: AreaLabelMarkerProps) {
  const [latitude, longitude] = polygonCentroid(geometry);

  return (
    <Marker
      position={[latitude, longitude]}
      icon={buildLabelIcon(name, selected, hasAed, hasToilet)}
      // ラベルはポリゴンの外へはみ出すことがあり、素通りさせるとはみ出し部分を押しても
      // 選択できない。クリックはポリゴンと同じ選択処理へ流す。キーボード操作は
      // ポリゴン側が担うため、フォーカス停止位置が二重にならないよう keyboard は切る
      interactive
      keyboard={false}
      eventHandlers={{ click: () => onSelect?.() }}
    />
  );
}
