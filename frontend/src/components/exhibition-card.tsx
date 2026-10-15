/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  getExhibitionGradient,
  getExhibitionAppearance,
} from '@/lib/exhibition-color';
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import { BookmarkButton } from './bookmark-button';
import { ImageIcon, PlaceIcon } from './icons';

export interface ExhibitionCardProps {
  readonly exhibition: ExhibitionCardSummary;
  readonly bookmarkable?: boolean;
}

export function ExhibitionCard({
  exhibition,
  bookmarkable = false,
}: ExhibitionCardProps) {
  const gradient = getExhibitionGradient(exhibition.displayName);
  const { texture, texturePositionY, textureFlipX, textureFlipY } =
    getExhibitionAppearance(exhibition.displayName);
  // globals.css の .exhibition-gradient-bg が参照する。α 付きの色は color-mix を使わず 8 桁 hex で渡す。
  // 透明端を transparent にすると to 色との補間で灰色の縁が出るため、to 自身の α0 を使う。
  // texture='gradient' は質感画像を重ねないので --exhibition-texture を設定しない (CSS 側の既定値 none を使う)。
  const gradientStyle = {
    '--exhibition-gradient-from': gradient.fromColor,
    '--exhibition-gradient-to': gradient.toColor,
    '--exhibition-gradient-to-half': `${gradient.toColor}80`,
    '--exhibition-gradient-to-clear': `${gradient.toColor}00`,
    '--exhibition-pool-x': `${gradient.poolX}%`,
    '--exhibition-pool-y': `${gradient.poolY}%`,
    ...(texture !== 'gradient' && {
      '--exhibition-texture': `url(/images/textures/card/${texture}.webp)`,
      '--exhibition-texture-y': `${texturePositionY}%`,
      '--exhibition-texture-sx': textureFlipX ? -1 : 1,
      '--exhibition-texture-sy': textureFlipY ? -1 : 1,
    }),
  } as CSSProperties;

  const thumbnailUrl = exhibition.thumbnail
    ? toAssetUrl(exhibition.thumbnail.id, 960)
    : null;

  return (
    <div className="relative flex flex-col overflow-clip rounded-xl transition-shadow hover:shadow-lg">
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
          style={gradientStyle}
          className={`exhibition-gradient-bg relative flex flex-col gap-1 p-4 ${bookmarkable ? 'pr-14' : ''}`}
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
            <h4 className="text-text">{exhibition.displayName}</h4>
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
