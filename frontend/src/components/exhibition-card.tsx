/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { getExhibitionTexture } from '@/lib/exhibition-color';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import { BookmarkButton } from './bookmark-button';
import { ImageIcon, PlaceIcon } from './icons';

export interface ExhibitionCardProps {
  readonly exhibition: ExhibitionCardSummary;
  readonly bookmarkable?: boolean;
  readonly variant?: 'site' | 'signage';
}

export function ExhibitionCard({
  exhibition,
  bookmarkable = false,
  variant = 'site',
}: ExhibitionCardProps) {
  const { texture, position, rotation } = getExhibitionTexture(
    exhibition.displayName,
  );
  // globals.css の html[data-pl] 規則が url に含まれる /images/textures/ を目印に load まで止める。
  // 原画は幅の 2 倍の正方形に敷いて回し、カードの地で切り抜く (縦が横の √3 倍以内なら隅が欠けない)。
  // 背景の幅は回す前の地の幅 × 2.5 (= 正方形の幅の 125%)
  const textureStyle: CSSProperties = {
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    backgroundImage: `url(/images/textures/pamphlet/${texture}.webp)`,
    backgroundSize: '125% auto',
    backgroundPosition: `${position[0]}% ${position[1]}%`,
  };

  const signage = variant === 'signage';
  const thumbnailUrl = exhibition.thumbnail
    ? toAssetUrl(exhibition.thumbnail.id, 960)
    : null;

  return (
    <div className="relative flex flex-col overflow-clip rounded-xl hover-card-shadow">
      <Link
        href={`/exhibitions/${exhibition.id}/${exhibition.category}`}
        className="flex flex-col focus-visible:outline-offset-[-2px]"
      >
        <div className="relative flex aspect-[300/225] w-full shrink-0 items-center justify-center overflow-clip bg-gray-200">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={exhibition.thumbnail!.alt}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <ImageIcon size={40} className="text-gray-400" />
          )}
        </div>
        <div
          className={`relative flex flex-col overflow-clip p-4 ${bookmarkable ? 'pr-14' : ''}`}
        >
          <div
            aria-hidden
            style={textureStyle}
            className="absolute top-1/2 left-1/2 aspect-square w-[200%]"
          />
          <div className="relative flex flex-col gap-1">
            {exhibition.location && (
              <span
                className={
                  signage
                    ? 'flex items-center gap-1 text-signage-meta text-gray-600'
                    : 'flex items-center gap-1 text-xs leading-[1.4] font-medium text-text'
                }
              >
                <PlaceIcon size={signage ? 24 : 16} />
                {signage ? (
                  <span className="min-w-0 flex-1 truncate">
                    {exhibition.location}
                  </span>
                ) : (
                  exhibition.location
                )}
              </span>
            )}
            <h4
              className={
                signage
                  ? 'line-clamp-2 text-signage-heading leading-[35px] font-bold text-text'
                  : 'text-text'
              }
            >
              {exhibition.displayName}
            </h4>
          </div>
        </div>
      </Link>
      {bookmarkable && (
        <BookmarkButton
          exhibitionId={exhibition.id}
          category={exhibition.category}
          displayName={exhibition.displayName}
          variant="card"
          className="absolute right-2 bottom-2 z-20"
        />
      )}
    </div>
  );
}
