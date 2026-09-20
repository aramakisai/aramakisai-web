import Link from 'next/link';
import type { CampusMapArea } from '@/lib/campus-map';
import type { ExhibitionDetail } from '@/lib/exhibitions';
import {
  buildAreaMapHref,
  resolveTargetAreas,
  toAreaBounds,
} from '@/lib/exhibition-location-map';
import { PlaceIcon } from '@/components/icons';
import { ExhibitionLocationMap } from './exhibition-location-map';

export interface ExhibitionLocationSectionProps {
  readonly exhibition: ExhibitionDetail;
  /** 取得済みの区画データ。取得の成否は呼び出し元が解決し、失敗時は空配列を渡す */
  readonly areas: readonly CampusMapArea[];
}

export function ExhibitionLocationSection({
  exhibition,
  areas,
}: ExhibitionLocationSectionProps) {
  const target = resolveTargetAreas(exhibition.areaIds, areas);
  if (target === null) {
    return null;
  }

  const [primaryArea, ...restAreas] = target.areas;
  // target.areas はタプル型だが .map() を経由すると通常配列へ広がるため、
  // 戻り値の位置へ直接書いてタプル型を保つ (exhibition-location-map.ts と同じ対処)
  const areaNames: readonly [string, ...string[]] = [
    primaryArea.name,
    ...restAreas.map((area) => area.name),
  ];
  const mapHref = buildAreaMapHref(target.primary);
  const caption = exhibition.location ?? areaNames.join('・');

  return (
    <section className="flex flex-col gap-2 border-t border-gray-200 pt-6 lg:pt-8">
      <h2 className="py-0 text-[20px] leading-[140%] text-primary lg:text-[24px] lg:leading-[130%]">
        場所
      </h2>
      <div className="relative">
        <ExhibitionLocationMap
          areas={target.areas}
          bounds={toAreaBounds(target.areas)}
          mapHref={mapHref}
          areaNames={areaNames}
        />
        {/* Figma 実測: MapLinkButton (PC 95:10 / SP 95:52)。地図読み込み中・失敗時も含め
            常に到達できる遷移リンクとして、地図領域の右下へ重ねて配置する */}
        <Link
          href={mapHref}
          className="absolute right-2 bottom-2 z-[1000] rounded-full border border-gray-200 bg-background px-3 py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 md:right-4 md:bottom-4"
        >
          構内マップで見る
        </Link>
      </div>
      <p className="flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-500">
        <PlaceIcon size={20} className="text-text" />
        {caption}
      </p>
    </section>
  );
}
