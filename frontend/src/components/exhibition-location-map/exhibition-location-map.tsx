'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { CampusMapArea } from '@/lib/campus-map';
import type { AreaBounds } from '@/lib/exhibition-location-map';
import { PlaceIcon } from '@/components/icons';
import { MapErrorBoundary } from './map-error-boundary';

// Server Component (企画詳細ページ) の中で ssr:false を指定するとビルドが失敗するため、
// Client Component であるこのファイルの中で動的読み込みを行う (design.md 参照)
const ExhibitionLocationMapView = dynamic(
  () =>
    import('./exhibition-location-map-view').then(
      (mod) => mod.ExhibitionLocationMapView,
    ),
  {
    ssr: false,
    loading: () => (
      // Figma 実測: MapPreview (95:4 PC / 95:46 SP) の高さ。読み込み中も同じ領域を確保しレイアウトのずれを防ぐ (要件 5.1)
      <div
        role="status"
        className="flex h-[240px] w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-400 md:h-[360px]"
      >
        地図を読み込んでいます…
      </div>
    ),
  },
);

export interface ExhibitionLocationMapProps {
  readonly areas: readonly [CampusMapArea, ...CampusMapArea[]];
  readonly bounds: AreaBounds;
  /** 描画資産の取得に失敗した際に表示する遷移先 */
  readonly mapHref: string;
  /** フォールバック時に表示するエリア名 */
  readonly areaNames: readonly [string, ...string[]];
}

export function ExhibitionLocationMap({
  areas,
  bounds,
  mapHref,
  areaNames,
}: ExhibitionLocationMapProps) {
  return (
    <MapErrorBoundary
      fallback={
        // dynamic の loading は読み込み失敗を捕捉しないため、失敗の検知と表示はこの境界が担う (要件 5.2)
        <div className="flex h-[240px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 p-4 text-center md:h-[360px]">
          <p className="flex items-center gap-1 text-sm font-medium text-gray-500">
            <PlaceIcon size={20} className="text-text" />
            {areaNames.join('・')}
          </p>
          <Link
            href={mapHref}
            className="flex items-center gap-1 rounded-full border border-gray-200 bg-background px-3 py-2 text-sm font-medium text-primary"
          >
            構内マップで見る
          </Link>
        </div>
      }
    >
      <ExhibitionLocationMapView areas={areas} bounds={bounds} />
    </MapErrorBoundary>
  );
}
