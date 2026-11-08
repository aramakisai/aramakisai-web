import type { CampusMapArea } from '@/lib/campus-map';
import type { EventDay } from '@/lib/home-page-types';
import { SignageClock } from './signage-clock';
import { SignageCurrentLocation } from './signage-current-location';
import { SignageDayDate, SignageLogo } from './signage-parts';

export interface SignagePortraitHeaderProps {
  readonly now: Date;
  readonly eventDays: readonly EventDay[];
  readonly installArea?: CampusMapArea | null;
}

export function SignagePortraitHeader({
  now,
  eventDays,
  installArea = null,
}: SignagePortraitHeaderProps) {
  return (
    <div className="flex h-[176px] w-[1032px] items-center justify-between">
      <SignageLogo className="h-full w-[312px]" />
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-[43px]">
          {installArea && <SignageCurrentLocation name={installArea.name} />}
          <SignageDayDate eventDays={eventDays} now={now} />
        </div>
        <SignageClock now={now} />
      </div>
    </div>
  );
}
