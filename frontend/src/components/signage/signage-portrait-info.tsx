import type { StageNowRow } from '@/lib/signage';
import {
  SignageIcon,
  SignageOfficialSite,
  SignageStageChip,
  formatPerformanceRange,
} from './signage-parts';

export interface SignagePortraitInfoProps {
  readonly rows: readonly StageNowRow[];
}

export function SignagePortraitInfo({ rows }: SignagePortraitInfoProps) {
  return (
    <div className="flex h-[536px] w-[1032px] items-center gap-6">
      <div className="flex w-[696px] shrink-0 flex-col gap-4">
        <div className="flex items-center gap-2 font-display text-[28px] leading-none font-bold text-text">
          <SignageIcon name="mic" />
          <span>いまのステージ</span>
        </div>
        <div className="flex w-full flex-col gap-6">
          {rows.map(({ stage, colorIndex, performance }) => (
            <div key={stage.id} className="flex w-full items-start gap-4">
              <div className="w-[192px] shrink-0">
                <SignageStageChip colorIndex={colorIndex} name={stage.name} />
              </div>
              <div className="flex min-w-px flex-1 flex-col gap-1">
                {performance ? (
                  <>
                    <p className="line-clamp-2 text-[36px] leading-[48px] font-bold text-text">
                      {performance.name}
                    </p>
                    <p className="text-[28px] leading-[1.25] whitespace-nowrap text-gray-500">
                      {formatPerformanceRange(performance)}
                    </p>
                  </>
                ) : (
                  <p className="text-[36px] leading-[48px] font-bold text-gray-500">
                    公演なし
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="w-[312px] shrink-0">
        <SignageOfficialSite labelClass="text-[32px]" qrClass="size-[288px]" />
      </div>
    </div>
  );
}
