'use client';

import { divIcon, type Marker as LeafletMarker } from 'leaflet';
import { useMemo, useState } from 'react';
import { Marker } from 'react-leaflet';
import type { CampusMapArea, CampusMapPoint } from '@/lib/campus-map';
import { CampusMapView } from './campus-map-view';

type FacilityKind = 'reception' | 'garbage' | 'live';
type Facility = {
  readonly id: string;
  readonly name: string;
  readonly kind: FacilityKind;
  readonly latitude: number;
  readonly longitude: number;
};

// 原図と地理座標の概算対応であり、現地確認前の未確定値。
const INITIAL_FACILITIES: readonly Facility[] = [
  {
    id: 'r1',
    name: '一般受付 1',
    kind: 'reception',
    latitude: 36.4314,
    longitude: 139.0441,
  },
  {
    id: 'r2',
    name: '一般受付 2',
    kind: 'reception',
    latitude: 36.4312,
    longitude: 139.0466,
  },
  {
    id: 'g1',
    name: 'ごみステーション 1',
    kind: 'garbage',
    latitude: 36.4304,
    longitude: 139.0442,
  },
  {
    id: 'g2',
    name: 'ごみステーション 2',
    kind: 'garbage',
    latitude: 36.4306,
    longitude: 139.0443,
  },
  {
    id: 'g3',
    name: 'ごみステーション 3',
    kind: 'garbage',
    latitude: 36.4309,
    longitude: 139.0445,
  },
  {
    id: 'g4',
    name: 'ごみステーション 4',
    kind: 'garbage',
    latitude: 36.4313,
    longitude: 139.0444,
  },
  {
    id: 'g5',
    name: 'ごみステーション 5',
    kind: 'garbage',
    latitude: 36.4309,
    longitude: 139.0449,
  },
  {
    id: 'g6',
    name: 'ごみステーション 6',
    kind: 'garbage',
    latitude: 36.4315,
    longitude: 139.0455,
  },
  {
    id: 'g7',
    name: 'ごみステーション 7',
    kind: 'garbage',
    latitude: 36.4307,
    longitude: 139.0464,
  },
  {
    id: 'g8',
    name: 'ごみステーション 8',
    kind: 'garbage',
    latitude: 36.431,
    longitude: 139.0462,
  },
  {
    id: 'live',
    name: 'ママタルトお笑いライブ専用受付',
    kind: 'live',
    latitude: 36.4302,
    longitude: 139.0447,
  },
];

const KIND_META: Record<
  FacilityKind,
  { label: string; color: string; symbol: string }
> = {
  reception: { label: '受付', color: '#80c1c6', symbol: '受' },
  garbage: { label: 'ごみステーション', color: '#8cb76b', symbol: 'ご' },
  live: { label: 'お笑いライブ専用受付', color: '#e86f30', symbol: '専' },
};

function markerIcon(facility: Facility) {
  const { color, symbol } = KIND_META[facility.kind];
  const number = facility.id === 'live' ? '' : facility.id.slice(1);
  return divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid #222;border-radius:50%;background:${color};color:#111;font-size:13px;font-weight:bold;box-shadow:0 1px 4px #555">${symbol}${number}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createCsv(facilities: readonly Facility[]) {
  const rows = facilities.map((point) =>
    [
      point.name,
      KIND_META[point.kind].label,
      point.latitude.toFixed(6),
      point.longitude.toFixed(6),
      '未確定',
    ].join(','),
  );
  return '\ufeff' + ['施設名,種別,緯度,経度,状態', ...rows].join('\r\n');
}

export function FacilityEditorMap({
  areas,
  points,
  areasUnavailable = false,
}: {
  readonly areas: readonly CampusMapArea[];
  readonly points: readonly CampusMapPoint[];
  readonly areasUnavailable?: boolean;
}) {
  const [facilities, setFacilities] = useState(INITIAL_FACILITIES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const selected = facilities.find((point) => point.id === selectedId);
  const csv = useMemo(() => createCsv(facilities), [facilities]);

  return (
    <main className="flex h-dvh flex-col lg:flex-row">
      <div className="min-h-0 flex-1">
        <CampusMapView
          areas={areas}
          points={points}
          selectedAreaId={selectedAreaId}
          onSelectArea={setSelectedAreaId}
        >
          {facilities.map((point) => (
            <Marker
              key={point.id}
              position={[point.latitude, point.longitude]}
              icon={markerIcon(point)}
              title={point.name}
              draggable
              zIndexOffset={10000}
              eventHandlers={{
                click: () => setSelectedId(point.id),
                dragend: (event) => {
                  const { lat, lng } = (
                    event.target as LeafletMarker
                  ).getLatLng();
                  setFacilities((current) =>
                    current.map((item) =>
                      item.id === point.id
                        ? { ...item, latitude: lat, longitude: lng }
                        : item,
                    ),
                  );
                  setSelectedId(point.id);
                },
              }}
            />
          ))}
        </CampusMapView>
      </div>
      <aside className="max-h-[38dvh] overflow-y-auto border-t border-gray-300 bg-white p-4 text-sm text-text lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l">
        <h1 className="text-lg font-bold">施設マーカー配置確認（開発用）</h1>
        <p className="mt-2">
          座標はすべて未確定です。現地・設営情報と照合してください。
        </p>
        <p className="mt-2">
          マーカーを選択またはドラッグして調整します。再読み込みすると初期値に戻ります。
        </p>
        {areasUnavailable && (
          <p role="alert" className="mt-2 font-bold">
            エリア情報を取得できませんでした。
          </p>
        )}
        <p className="mt-2">水色：一般受付　緑：ごみ　橙：専用受付</p>
        <div
          className="mt-3 rounded border border-gray-300 p-3"
          aria-live="polite"
        >
          {selected ? (
            <>
              <strong>{selected.name}</strong>
              <p>
                {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
              </p>
            </>
          ) : (
            <p>マーカーを選択してください。</p>
          )}
        </div>
        <a
          className="mt-3 inline-block rounded bg-primary px-4 py-2 font-bold text-text"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="facility-positions-unconfirmed.csv"
        >
          CSVをダウンロード
        </a>
      </aside>
    </main>
  );
}
