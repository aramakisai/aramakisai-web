/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { exhibitionTextureStyle } from '@/lib/exhibition-color';
import { toCardImageUrl } from '@/lib/cms-asset-url';
import { listingHref, type ListingCard } from '@/lib/exhibitions';
import { BookmarkButton } from './bookmark-button';
import { ImageIcon, PlaceIcon } from './icons';

export interface ExhibitionCardProps {
  readonly exhibition: ListingCard;
  readonly bookmarkable?: boolean;
  readonly variant?: 'site' | 'signage';
  /** ファーストビューの画像。遅延読み込みせず優先して取得する */
  readonly priority?: boolean;
}

export function ExhibitionCard({
  exhibition,
  bookmarkable = false,
  variant = 'site',
  priority = false,
}: ExhibitionCardProps) {
  const textureStyle = exhibitionTextureStyle(exhibition.displayName);

  // 企業ブースは ブックマーク・スタンプの保存形式 (学生企画のカテゴリ) の対象外
  const showBookmark = bookmarkable && exhibition.category !== 'booth';
  const signage = variant === 'signage';
  const thumbnailUrl = exhibition.thumbnail
    ? toCardImageUrl(exhibition.thumbnail)
    : null;

  return (
    <div className="relative flex flex-col overflow-clip rounded-xl hover-card-shadow">
      <Link
        href={listingHref(exhibition)}
        className="flex flex-col focus-visible:outline-offset-[-2px]"
      >
        <div className="relative flex aspect-[300/225] w-full shrink-0 items-center justify-center overflow-clip bg-gray-200">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={exhibition.thumbnail!.alt}
              loading={priority ? undefined : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <ImageIcon size={40} className="text-gray-400" />
          )}
        </div>
        <div
          className={`relative flex flex-col overflow-clip p-4 ${showBookmark ? 'pr-14' : ''}`}
        >
          <div
            aria-hidden
            style={textureStyle}
            className="absolute top-1/2 left-1/2 aspect-square w-[120%]"
          />
          <div className="relative flex flex-col gap-1">
            <span
              aria-hidden={exhibition.location ? undefined : true}
              className={`flex min-h-[1lh] items-center gap-1 ${
                signage
                  ? 'text-signage-meta text-gray-600'
                  : 'text-xs leading-[1.4] font-medium text-text'
              } ${exhibition.location ? '' : 'invisible'}`}
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
            <h4
              className={`line-clamp-2 h-[2lh] ${
                signage
                  ? 'text-signage-heading leading-[35px] font-bold text-text'
                  : 'text-text'
              }`}
            >
              {exhibition.displayName}
            </h4>
          </div>
        </div>
      </Link>
      {showBookmark && (
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
