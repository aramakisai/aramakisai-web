import {
  LISTING_CATEGORY_LABELS,
  listingHref,
  type ListingCategory,
  type ListingDetail,
} from '@/lib/exhibitions';
import { env } from '@/env';
import type { CampusMapArea } from '@/lib/campus-map';
import type { ExhibitionPerformance } from '@/lib/timetable';
import { ExhibitionGallery } from '@/components/exhibition-gallery';
import { ExhibitionPerformances } from '@/components/exhibition-performances';
import { ExhibitionMenu } from '@/components/exhibition-menu';
import { ExhibitionLinks } from '@/components/exhibition-links';
import { ExhibitionLocationSection } from '@/components/exhibition-location-map/exhibition-location-section';
import { BookmarkButton } from '@/components/bookmark-button';
import { ShareButton } from '@/components/share-button';
import { CalendarMonthIcon, PlaceIcon } from '@/components/icons';

const CATEGORY_BADGE_COLORS: Readonly<Record<ListingCategory, string>> = {
  stage: 'bg-accent',
  exhibit: 'bg-info',
  vendor: 'bg-warning',
  other: 'bg-accent-alt',
  booth: 'bg-secondary',
};

function CategoryBadge({
  category,
  signage,
}: {
  readonly category: ListingCategory;
  readonly signage: boolean;
}) {
  return (
    <span
      className={`rounded-full text-text ${CATEGORY_BADGE_COLORS[category]} ${signage ? 'px-3 py-1 text-signage-label' : 'px-3 py-1 text-xs leading-[140%] font-medium'}`}
    >
      {LISTING_CATEGORY_LABELS[category]}
    </span>
  );
}

export interface ExhibitionDetailBodyProps {
  readonly exhibition: ListingDetail;
  readonly areas: readonly CampusMapArea[];
  readonly performances: readonly ExhibitionPerformance[] | null;
  readonly openDays: string | null;
  readonly variant?: 'site' | 'signage';
}

/** 公開ページでは親の縦並びにそのまま入る兄弟要素を、端末用では3列の1つの塊を返す */
export function ExhibitionDetailBody({
  exhibition,
  areas,
  performances,
  openDays,
  variant = 'site',
}: ExhibitionDetailBodyProps) {
  if (variant === 'signage') {
    return (
      <SignageBody
        exhibition={exhibition}
        areas={areas}
        performances={performances}
        openDays={openDays}
      />
    );
  }

  const shareUrl = `${env.NEXT_PUBLIC_SITE_URL}${listingHref(exhibition)}`;

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
        <div className="lg:w-[640px] lg:shrink-0">
          <ExhibitionGallery
            images={exhibition.images}
            fallbackAlt={exhibition.displayName}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-1 lg:gap-4">
          <div className="flex flex-wrap gap-2">
            {exhibition.categories.map((c) => (
              <CategoryBadge key={c} category={c} signage={false} />
            ))}
          </div>
          <h1 className="py-0 text-[28px] leading-[130%] text-text lg:text-[32px] lg:leading-[125%]">
            {exhibition.displayName}
          </h1>
          <p className="text-base leading-[180%] text-text">
            {exhibition.organizationName}
          </p>
          {exhibition.location && (
            <p className="flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-600">
              <PlaceIcon size={20} className="text-text" />
              {exhibition.location}
            </p>
          )}

          {openDays && (
            <p className="flex items-center gap-1 text-sm leading-[140%] font-medium text-gray-600">
              <CalendarMonthIcon size={20} className="text-text" />
              {openDays}
            </p>
          )}
          {performances && (
            <ExhibitionPerformances performances={performances} />
          )}

          {exhibition.category === 'vendor' && (
            <ExhibitionMenu items={exhibition.menu} />
          )}

          <ShareButton
            title={exhibition.displayName}
            url={shareUrl}
            leading={
              exhibition.category === 'booth' ? undefined : (
                <BookmarkButton
                  exhibitionId={exhibition.id}
                  category={exhibition.category}
                  displayName={exhibition.displayName}
                  variant="detail"
                />
              )
            }
          >
            <ExhibitionLinks links={exhibition.links} />
          </ShareButton>
        </div>
      </div>

      {exhibition.description && (
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-6 lg:pt-8">
          <h2 className="py-0 text-[20px] leading-[140%] text-text lg:text-[24px] lg:leading-[130%]">
            紹介
          </h2>
          <p className="text-base leading-[180%] whitespace-pre-wrap text-text">
            {exhibition.description}
          </p>
        </div>
      )}

      <ExhibitionLocationSection exhibition={exhibition} areas={areas} />
    </>
  );
}

function SignageBody({
  exhibition,
  areas,
  performances,
  openDays,
}: Omit<ExhibitionDetailBodyProps, 'variant'>) {
  return (
    <div className="flex items-start gap-6">
      <div className="w-[560px] shrink-0">
        <ExhibitionGallery
          images={exhibition.images}
          fallbackAlt={exhibition.displayName}
        />
      </div>

      <div className="flex w-[520px] shrink-0 flex-col gap-4">
        <div className="flex gap-2">
          {exhibition.categories.map((c) => (
            <CategoryBadge key={c} category={c} signage />
          ))}
        </div>
        <h1 className="py-0 text-signage-title leading-[40px] tracking-[0.02em] text-text">
          {exhibition.displayName}
        </h1>
        <p className="text-signage-body text-text">
          {exhibition.organizationName}
        </p>
        {exhibition.location && (
          <p className="flex items-center gap-1 text-signage-meta text-gray-600">
            <PlaceIcon size={24} className="text-gray-600" />
            {exhibition.location}
          </p>
        )}
        {openDays && (
          <p className="flex items-center gap-1 text-signage-meta text-gray-600">
            <CalendarMonthIcon size={24} className="text-gray-600" />
            {openDays}
          </p>
        )}
        {performances && (
          <ExhibitionPerformances
            performances={performances}
            variant="signage"
          />
        )}
        {exhibition.category === 'vendor' && (
          <ExhibitionMenu items={exhibition.menu} variant="signage" />
        )}
      </div>

      <div className="flex w-[744px] shrink-0 flex-col">
        {exhibition.description && (
          <div className="flex flex-col gap-2 border-t border-gray-200">
            <h2 className="py-0 text-signage-heading leading-[35px] tracking-[0.02em] text-text">
              紹介
            </h2>
            <p className="line-clamp-5 min-h-[190px] text-signage-body whitespace-pre-wrap text-text">
              {exhibition.description}
            </p>
          </div>
        )}
        <ExhibitionLocationSection
          exhibition={exhibition}
          areas={areas}
          variant="signage"
        />
      </div>
    </div>
  );
}
