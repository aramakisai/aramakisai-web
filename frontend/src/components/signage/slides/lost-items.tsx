/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import { formatEventDayTime } from '@/lib/event-day';
import type { SignageLostItem } from '@/lib/signage';
import { SignageHeadingChip } from '../signage-heading-chip';

export function LostItemsSlide({
  items,
}: {
  readonly items: readonly SignageLostItem[];
}) {
  return (
    <div className="relative h-[864px] w-[1536px] overflow-clip rounded-2xl bg-white">
      <SignageHeadingChip icon="search" label="落とし物" />
      <ul className="absolute top-[100px] left-6 grid font-display grid-cols-[repeat(4,336px)] gap-x-12 gap-y-4">
        {items.map((item) => {
          const photo = toAssetUrl(item.photoId, 960);
          return (
            <li key={item.id} className="flex w-[336px] flex-col gap-2">
              <div className="h-[252px] w-[336px] bg-gray-200">
                {photo && (
                  <img src={photo} alt="" className="size-full object-cover" />
                )}
              </div>
              <p className="truncate text-[30px] leading-[1.2] font-bold text-text">
                {item.name}
              </p>
              <p className="truncate text-[24px] leading-[1.2] text-gray-600">
                {item.foundPlace}｜{formatEventDayTime(item.foundAt)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="absolute right-6 bottom-6 font-display text-[28px] leading-[1.2] font-bold text-text">
        本部テントでお預かりしています
      </p>
    </div>
  );
}
