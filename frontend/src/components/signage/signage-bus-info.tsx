import busTimetable from '@/data/bus-timetable.json';
import { BusDataNotice } from '@/components/bus/bus-data-notice';
import type { DirectionBoard } from '@/lib/bus-next-departures';
import { SignageIcon } from './signage-parts';

export interface SignageBusInfoProps {
  readonly boards: readonly DirectionBoard[];
}

/**
 * 列幅は列見出しと全便で位置を揃えるため固定。行先は最長 9 文字(横型 20px×9、縦型 32px×9)で
 * 枠の大きさが変わらない幅にする。寸法の違いはすべて`portrait:`で切り替える
 */
export function SignageBusInfo({ boards }: SignageBusInfoProps) {
  return (
    <div className="flex h-[144px] w-[528px] flex-col items-start gap-[2px] overflow-clip rounded-[16px] border border-solid border-gray-200 bg-white px-4 py-[6px] portrait:h-[363px] portrait:w-[1032px] portrait:justify-center portrait:gap-1 portrait:px-6 portrait:py-3">
      <div className="flex items-center gap-2 overflow-clip text-[18px] leading-none whitespace-nowrap text-text portrait:text-[24px]">
        <SignageIcon name="directions_bus" />
        <span className="font-bold">バス発車案内</span>
        <span className="text-gray-600">荒牧キャンパスエリア</span>
      </div>
      <div className="flex w-full items-center gap-2 overflow-clip text-[12px] leading-none text-gray-600 portrait:gap-3 portrait:text-[18px]">
        <span className="w-16 shrink-0 portrait:w-[103px]">発車時刻</span>
        <span className="w-[55px] shrink-0 portrait:w-[89px]">系統</span>
        <span className="w-[180px] shrink-0 portrait:w-[288px]">
          行先・のりば
        </span>
        <span className="min-w-px flex-1 text-right">発車まで</span>
      </div>
      <div className="flex w-full flex-col gap-1 overflow-clip portrait:gap-2">
        {boards.flatMap((board) =>
          board.departures.length === 0
            ? [
                <div
                  key={board.direction}
                  data-testid="bus-departure-ended"
                  className="flex w-full flex-col gap-1 portrait:gap-2"
                >
                  <div className="flex h-[38px] w-full items-center overflow-clip portrait:h-[60px]">
                    <span
                      aria-hidden="true"
                      className="h-px w-[72px] shrink-0 portrait:w-[115px]"
                    />
                    <span className="min-w-px flex-1 text-[20px] leading-none text-gray-600 portrait:text-[32px]">
                      本日の運行は終了しました
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="hidden h-[60px] w-full portrait:block"
                  />
                </div>,
              ]
            : board.departures.map((d) => (
                <div
                  key={`${board.direction}-${d.route}-${d.scheduledAt}`}
                  data-testid="bus-departure-row"
                  className="flex w-full items-center gap-2 overflow-clip portrait:gap-3"
                >
                  <span className="w-16 shrink-0 text-[20px] leading-none font-bold [font-variant-numeric:tabular-nums] text-text portrait:w-[103px] portrait:text-[32px]">
                    {d.scheduledAt}
                  </span>
                  <span className="flex w-[55px] shrink-0 items-center justify-center rounded-[4px] bg-primary px-[6px] py-px text-[20px] leading-none font-bold whitespace-nowrap text-text portrait:w-[89px] portrait:px-[10px] portrait:py-[2px] portrait:text-[32px]">
                    {d.route}
                  </span>
                  <span className="flex w-[180px] shrink-0 flex-col gap-[2px] overflow-clip portrait:w-[288px]">
                    <span className="flex h-[22px] items-center text-[20px] leading-none font-bold whitespace-nowrap text-text portrait:h-9 portrait:text-[32px]">
                      {d.destination}
                    </span>
                    <span className="text-[14px] leading-none whitespace-nowrap text-gray-600 portrait:text-[22px]">
                      {d.stopName} 発
                    </span>
                  </span>
                  <span className="flex min-w-px flex-1 flex-col items-end gap-[2px] self-stretch justify-center overflow-clip text-right text-warning">
                    <span className="flex h-[22px] items-center text-[20px] leading-none font-bold [font-variant-numeric:tabular-nums] portrait:h-9 portrait:text-[32px]">
                      {d.minutesLeft === 0 ? 'まもなく' : `${d.minutesLeft}分`}
                    </span>
                    {d.delayMinutes > 0 && (
                      <span className="text-[14px] leading-none portrait:text-[22px]">
                        約{d.delayMinutes}分遅れ
                      </span>
                    )}
                  </span>
                </div>
              )),
        )}
      </div>
      <div className="text-[12px] leading-none whitespace-nowrap portrait:text-[18px]">
        <BusDataNotice
          variant="signage"
          timetableFetchedAt={busTimetable.fetchedAt}
          realtimeGeneratedAt={null}
        />
      </div>
    </div>
  );
}
