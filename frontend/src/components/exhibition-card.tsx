/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { getExhibitionGradient } from '@/lib/exhibition-color';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionSummary } from '@/lib/exhibitions';
import { HideImageIcon, PlaceIcon } from './icons';

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
      className="flex h-full flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-lg"
    >
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={exhibition.thumbnail!.alt}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <HideImageIcon className="text-gray-500" />
          </div>
        )}
      </div>
      <div
        style={gradientStyle}
        className="exhibition-gradient-bg relative flex flex-1 flex-col justify-center gap-1 p-4"
      >
        <div className="relative z-10 flex flex-col gap-1 text-text">
          {exhibition.location && (
            <span className="flex items-center gap-1 text-sm">
              <PlaceIcon size={16} />
              {exhibition.location}
            </span>
          )}
          <h3 className="font-bold">{exhibition.name}</h3>
        </div>
      </div>
    </Link>
  );
}
