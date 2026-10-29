import { CrossFade } from '../cross-fade';
import type { StageNowRow } from '@/lib/signage';
import { pageStagesAt } from '@/lib/timetable';
import {
  SignageIcon,
  SignageOfficialSite,
  SignageStageChip,
  formatPerformanceRange,
} from './signage-parts';

export interface SignagePortraitInfoProps {
  readonly rows: readonly StageNowRow[] | null;
  readonly now: Date;
}

export function SignagePortraitInfo({ rows, now }: SignagePortraitInfoProps) {
  const page = rows ? pageStagesAt(rows, now.getTime()) : null;
  return (
    <div className="flex h-[536px] w-[1032px] items-center gap-6">
      <div className="flex w-[696px] shrink-0 flex-col gap-4">
        {rows && page && (
          <>
            <div className="flex items-center gap-2 font-display text-[28px] leading-none font-bold text-text">
              <SignageIcon name="mic" />
              <span>いまのステージ</span>
            </div>
            <CrossFade
              transitionKey={String(page.pageIndex)}
              enabled={page.pageCount > 1}
              className={page.pageCount > 1 ? 'h-[357px] w-full' : 'w-full'}
              fadePrevious
            >
              <div className="flex w-full flex-col gap-6">
                {page.items.map(({ stage, colorIndex, performance }) => (
                  <div key={stage.id} className="flex w-full items-start gap-4">
                    <div className="w-[192px] shrink-0">
                      <SignageStageChip
                        colorIndex={colorIndex}
                        name={stage.name}
                      />
                    </div>
                    <CrossFade
                      transitionKey={String(performance?.id ?? 'none')}
                      className="min-w-px flex-1"
                      layerClassName="flex flex-col gap-1"
                      fadePrevious
                    >
                      {performance ? (
                        <>
                          <p className="line-clamp-2 text-[36px] leading-[48px] font-bold text-text">
                            {performance.name}
                          </p>
                          <p className="text-[28px] leading-[1.25] whitespace-nowrap text-gray-600">
                            {formatPerformanceRange(performance)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[36px] leading-[48px] font-bold text-gray-600">
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
      <div className="w-[312px] shrink-0">
        <SignageOfficialSite labelClass="text-[32px]" qrClass="size-[288px]" />
      </div>
    </div>
  );
}
