/* eslint-disable @next/next/no-img-element */
import { toHeroImage } from '@/lib/cms-asset-url';
import type { Attachment } from '@/lib/home-page-types';
import { SignageHeadingChip } from '../signage-heading-chip';

export function ImageSlide({
  kind,
  image,
}: {
  readonly kind: 'image' | 'campus_map';
  readonly image: Attachment | null;
}) {
  const hero = image ? toHeroImage(image) : null;
  return (
    <div
      className={`relative h-[864px] w-[1536px] overflow-clip rounded-2xl ${hero ? 'bg-white' : kind === 'campus_map' ? 'bg-gray-100' : 'bg-gray-200'}`}
    >
      {hero && (
        <img
          src={hero.src}
          srcSet={hero.srcSet}
          sizes="1536px"
          alt=""
          className="size-full object-contain"
        />
      )}
      {kind === 'campus_map' && (
        <SignageHeadingChip icon="map" label="構内マップ" />
      )}
    </div>
  );
}
