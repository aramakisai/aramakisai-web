/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { getExhibitionGradient } from '@/lib/exhibition-color';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionSummary } from '@/lib/exhibitions';
import { ImageIcon, PlaceIcon } from './icons';

export interface ExhibitionCardProps {
  readonly exhibition: ExhibitionSummary;
}

export function ExhibitionCard({ exhibition }: ExhibitionCardProps) {
  const gradient = getExhibitionGradient(exhibition.name);
  // globals.css の .exhibition-gradient-bg が参照する。角度は単位付きでないと
  // linear-gradient() に渡した際に無効な値としてカスケード全体が無視される。
  const gradientStyle = {
    '--exhibition-gradient-from': gradient.fromColor,
    '--exhibition-gradient-to': gradient.toColor,
    '--exhibition-gradient-angle': `${gradient.angle}deg`,
  } as CSSProperties;

  const thumbnailUrl = exhibition.thumbnail
    ? toAssetUrl(exhibition.thumbnail.id, 960)
    : null;

  return (
    <Link
      href={`/exhibitions/${exhibition.id}`}
      className="flex flex-col overflow-clip rounded-xl transition-shadow hover:shadow-lg"
    >
      <div className="flex aspect-[300/225] w-full shrink-0 items-center justify-center overflow-clip bg-gray-200">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={exhibition.thumbnail!.alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={40} className="text-gray-400" />
        )}
      </div>
      <div
        style={gradientStyle}
        className="exhibition-gradient-bg relative flex flex-col gap-1 p-4"
      >
        {/* ::before の白オーバーレイは absolute のため通常フローの兄弟より先に描画される。
            z-10 で明示的に重ねないとテキストがオーバーレイの下に隠れる。 */}
        <div className="relative z-10 flex flex-col gap-1">
          {exhibition.location && (
            <span className="flex items-center gap-1 text-xs leading-[1.4] font-medium text-text">
              <PlaceIcon size={16} />
              {exhibition.location}
            </span>
          )}
          <h4 className="text-text">{exhibition.name}</h4>
        </div>
      </div>
    </Link>
  );
}
