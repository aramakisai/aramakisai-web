'use client';

import { useEffect, useRef } from 'react';
import { DomEvent } from 'leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { useMap } from 'react-leaflet';

// lib/exhibition-location-map の AreaBounds と同じ形にしている。同モジュールは
// 未実装のため、実装後はそちらの型を import する形に差し替えられる
export interface RecenterButtonBounds {
  readonly southWest: readonly [latitude: number, longitude: number];
  readonly northEast: readonly [latitude: number, longitude: number];
}

export interface RecenterButtonProps {
  readonly bounds: RecenterButtonBounds;
}

export function RecenterButton({ bounds }: RecenterButtonProps) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node) return;
    // L.Control が内部で行うのと同じ対処。素の DOM ノードのままだと mousedown が
    // 地図のパン操作へ、dblclick/wheel がズーム操作へ伝播してしまう
    DomEvent.disableClickPropagation(node);
    DomEvent.disableScrollPropagation(node);
  }, []);

  const recenter = () => {
    // leaflet の型は mutable なタプルを要求するため、readonly な bounds をここでキャストする
    const latLngBounds = [
      bounds.southWest,
      bounds.northEast,
    ] as unknown as LatLngBoundsExpression;
    map.fitBounds(latLngBounds);
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={recenter}
      className="absolute bottom-2 left-2 z-[1000] rounded-full border border-gray-200 bg-background px-3 py-2 text-sm font-medium text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 md:bottom-4 md:left-4"
    >
      企画位置に戻す
    </button>
  );
}
