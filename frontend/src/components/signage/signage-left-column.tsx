import { CrossFade } from '../cross-fade';
import type { EventDay } from '@/lib/home-page-types';
import type { StageNowRow } from '@/lib/signage';
import { pageStagesAt } from '@/lib/timetable';
import { SignageClock } from './signage-clock';
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
  readonly rows: readonly StageNowRow[] | null;
}

export function SignageLeftColumn({
  now,
  eventDays,
  rows,
}: SignageLeftColumnProps) {
  const page = rows ? pageStagesAt(rows, now.getTime()) : null;
  return (
    <div className="flex h-[1032px] w-[312px] flex-col items-start justify-between pt-4">
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-6">
          <SignageLogo className="h-[55.42px] w-full" />
          <SignageDayDate eventDays={eventDays} now={now} />
        </div>
        <SignageClock now={now} />
        <div className="h-px w-full bg-gray-200" />
        {rows && page && (
          <>
            <div className="flex items-center gap-2 font-display text-[28px] leading-none font-bold text-text">
              <SignageIcon name="mic" />
              <span>いまのステージ</span>
            </div>
            <CrossFade
              transitionKey={String(page.pageIndex)}
              enabled={page.pageCount > 1}
              className="w-full"
              fadePrevious
            >
              <div className="flex w-full flex-col gap-5">
                {page.items.map(({ stage, colorIndex, performance }) => (
                  <div
                    key={stage.id}
                    className="flex w-full flex-col items-start gap-1"
                  >
                    <SignageStageChip
                      colorIndex={colorIndex}
                      name={stage.name}
                    />
                    <CrossFade
                      transitionKey={String(performance?.id ?? 'none')}
                      className="w-full"
                      layerClassName="flex flex-col gap-1"
                      fadePrevious
                    >
                      {performance ? (
                        <>
                          <p className="line-clamp-2 w-full text-[28px] leading-[1.25] font-bold text-text">
                            {performance.name}
                          </p>
                          <p className="text-[24px] leading-[1.25] whitespace-nowrap text-gray-600">
                            {formatPerformanceRange(performance)}
                          </p>
                        </>
                      ) : (
                        <p className="text-signage-heading font-bold text-gray-600">
                          公演なし
                        </p>
                      )}
                    </CrossFade>
                  </div>
                ))}
              </div>
            </CrossFade>
          </>
        )}
      </div>
      <SignageOfficialSite labelClass="text-[28px]" qrClass="size-[240px]" />
    </div>
  );
}
