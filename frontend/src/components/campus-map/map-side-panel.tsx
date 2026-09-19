'use client';

import { useSyncExternalStore } from 'react';
import type { AreaOption } from '@/lib/exhibitions';
import {
  AreaExhibitionList,
  type AreaExhibitionListState,
} from './area-exhibition-list';
import { MapSearchPanel, type MapSearchProps } from './map-search-panel';

// Tailwind 既定の 'md' (MAP_BREAKPOINT, src/lib/campus-map-config.ts) と同じ 768px。
// tailwind.config.ts は screens を上書きしていないため既定値をそのまま使う
const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

// SSR はビューポート幅を知らないため非表示側を初期値にする。useSyncExternalStore が
// hydration 直後に実際の幅と再同期するため、可視状態の不整合は描画前に解消される
function getServerSnapshot(): boolean {
  return false;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface MapSidePanelProps {
  readonly search: MapSearchProps;
  readonly areas: readonly AreaOption[];
  /** ポリゴンとキーボード選択の代替経路 (要件 10.1) が現在選んでいるエリア */
  readonly selectedAreaId: number | null;
  readonly onSelectArea: (areaId: number | null) => void;
  readonly listState: AreaExhibitionListState;
  readonly notice?: string | null;
}

export function MapSidePanel({
  search,
  areas,
  selectedAreaId,
  onSelectArea,
  listState,
  notice,
}: MapSidePanelProps) {
  const isDesktop = useIsDesktop();

  return (
    <div
      aria-hidden={!isDesktop}
      inert={!isDesktop}
      // 表示自体は CSS のブレークポイント (MAP_BREAKPOINT) に委ね、aria-hidden/inert は
      // 支援技術とキーボードフォーカスの除外専用に JS 側で同期させる (design.md 参照)
      className="absolute inset-y-6 left-6 z-[1000] hidden w-[348px] max-w-[calc(50%-2rem)] flex-col gap-4 overflow-visible rounded-xl border border-gray-200 bg-white p-6 shadow-card md:flex"
    >
      <MapSearchPanel {...search} />

      {areas.length > 0 && (
        <div
          role="group"
          aria-label="エリアを選択"
          className="flex flex-wrap gap-2"
        >
          {areas.map((area) => {
            const pressed = area.id === selectedAreaId;
            return (
              <button
                key={area.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onSelectArea(pressed ? null : area.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  pressed
                    ? 'border-primary bg-primary text-text'
                    : 'border-gray-200 bg-background text-text'
                }`}
              >
                {area.name}
              </button>
            );
          })}
        </div>
      )}

      {/*
       * 検索欄・カテゴリ・エリアチップは固定ヘッダーとして残し、リストだけを内側でスクロールさせる。
       * AreaExhibitionList 自体は編集対象外のため、ここでラップして overflow を持たせる
       */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AreaExhibitionList state={listState} notice={notice} />
      </div>
    </div>
  );
}
