'use client';

import { useEffect, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { GeoJSON as LeafletGeoJSON, Path, PathOptions } from 'leaflet';
import { resolveAreaColor, type CampusMapArea } from '@/lib/campus-map';
import { AreaLabelMarker } from './area-label-marker';

const FILL_OPACITY = 0.55;
const SELECTED_FILL_OPACITY = 0.72;
const WEIGHT = 2;
const SELECTED_WEIGHT = 4;

export interface AreaPolygonLayerProps {
  readonly areas: readonly CampusMapArea[];
  readonly selectedAreaId: number | null;
  readonly onAreaClick: (areaId: number) => void;
}

function buildAreaStyle(area: CampusMapArea, selected: boolean): PathOptions {
  const color = resolveAreaColor(area.color);
  return {
    color,
    fillColor: color,
    fillOpacity: selected ? SELECTED_FILL_OPACITY : FILL_OPACITY,
    weight: selected ? SELECTED_WEIGHT : WEIGHT,
    interactive: true,
  };
}

/**
 * ポリゴンにキーボード操作を付与する。Leaflet のベクタパスは既定でフォーカス不可なため、
 * 描画された SVG 要素へ直接 tabindex と keydown を付与する (design.md 参照)。
 * tabindex 属性の有無を登録済みかの目印にして二重登録を避ける。
 */
function attachKeyboardSelection(
  element: Element | null | undefined,
  areaName: string,
  onSelect: () => void,
): void {
  if (!element || element.hasAttribute('tabindex')) return;
  element.setAttribute('tabindex', '0');
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', areaName);
  element.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'Enter' && key !== ' ') return;
    event.preventDefault();
    onSelect();
  });
}

function AreaPolygon({
  area,
  selected,
  onSelect,
}: {
  readonly area: CampusMapArea;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const groupRef = useRef<LeafletGeoJSON | null>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // 子レイヤーの SVG 要素は地図へ追加された後に生成される (Path.getElement 参照)。
    // マウント直後は要素が存在しないため、'add' イベント後にも再試行する
    const attach = () => {
      for (const layer of group.getLayers()) {
        attachKeyboardSelection(
          (layer as Path).getElement?.(),
          area.name,
          onSelect,
        );
      }
    };
    attach();
    group.on('add', attach);
    return () => {
      group.off('add', attach);
    };
  }, [area.name, onSelect]);

  return (
    <GeoJSON
      ref={groupRef}
      data={area.geometry}
      style={buildAreaStyle(area, selected)}
      eventHandlers={{ click: onSelect }}
    />
  );
}

export function AreaPolygonLayer({
  areas,
  selectedAreaId,
  onAreaClick,
}: AreaPolygonLayerProps) {
  return (
    <>
      {areas.map((area) => (
        <AreaPolygon
          key={area.id}
          area={area}
          selected={area.id === selectedAreaId}
          onSelect={() => onAreaClick(area.id)}
        />
      ))}
      {areas.map((area) => (
        <AreaLabelMarker
          key={area.id}
          name={area.name}
          geometry={area.geometry}
          selected={area.id === selectedAreaId}
        />
      ))}
    </>
  );
}
