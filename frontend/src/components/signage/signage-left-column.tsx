import type { EventDay } from '@/lib/home-page-types';
import type { StageNowRow } from '@/lib/signage';
import { formatSignageClock } from '@/lib/signage-clock';
import {
  SignageDayDate,
  SignageIcon,
  SignageLogo,
  SignageOfficialSite,
  SignageStageChip,
  formatPerformanceRange,
} from './signage-parts';

export interface SignageLeftColumnProps {
  readonly now: Date;
  readonly eventDays: readonly EventDay[];
  readonly rows: readonly StageNowRow[];
}

export function SignageLeftColumn({
  now,
  eventDays,
  rows,
}: SignageLeftColumnProps) {
  return (
    <div className="flex h-[1032px] w-[312px] flex-col items-start justify-between pt-4">
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-6">
          <SignageLogo className="h-[55.42px] w-full" />
          <SignageDayDate eventDays={eventDays} now={now} />
        </div>
        <p className="font-display text-[104px] leading-none font-extrabold whitespace-nowrap text-text">
          {formatSignageClock(now)}
        </p>
        <div className="h-px w-full bg-gray-200" />
        <div className="flex items-center gap-2 font-display text-[28px] leading-none font-bold text-text">
          <SignageIcon name="mic" />
          <span>いまのステージ</span>
        </div>
        <div className="flex w-full flex-col gap-5">
          {rows.map(({ stage, colorIndex, performance }) => (
            <div
              key={stage.id}
              className="flex w-full flex-col items-start gap-1"
            >
              <SignageStageChip colorIndex={colorIndex} name={stage.name} />
              {performance ? (
                <>
                  <p className="line-clamp-2 w-full font-noto text-[30px] leading-[1.25] font-bold text-text">
                    {performance.name}
                  </p>
                  <p className="font-noto text-[24px] leading-[1.25] whitespace-nowrap text-gray-600">
                    {formatPerformanceRange(performance)}
                  </p>
                </>
              ) : (
                <p className="font-noto text-[30px] leading-[1.25] font-bold text-gray-600">
                  公演なし
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      <SignageOfficialSite labelClass="text-[28px]" qrClass="size-[240px]" />
    </div>
  );
}
