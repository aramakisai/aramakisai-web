import type { EventDay } from '@/lib/home-page-types';
import { formatSignageClock } from '@/lib/signage-clock';
import { SignageDayDate, SignageLogo } from './signage-parts';

export interface SignagePortraitHeaderProps {
  readonly now: Date;
  readonly eventDays: readonly EventDay[];
}

export function SignagePortraitHeader({
  now,
  eventDays,
}: SignagePortraitHeaderProps) {
  return (
    <div className="flex h-[176px] w-[1032px] items-center justify-between">
      <SignageLogo className="h-full w-[312px]" />
      <div className="flex flex-col items-end gap-2">
        <SignageDayDate eventDays={eventDays} now={now} />
        <p className="font-display text-[104px] leading-none font-extrabold whitespace-nowrap text-text">
          {formatSignageClock(now)}
        </p>
      </div>
    </div>
  );
}
