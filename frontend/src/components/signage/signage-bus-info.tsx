import busTimetable from '@/data/bus-timetable.json';
import { BusDataNotice } from '@/components/bus/bus-data-notice';
import type { DirectionBoard } from '@/lib/bus-next-departures';
import { SignageIcon } from './signage-parts';

export interface SignageBusInfoProps {
  readonly boards: readonly DirectionBoard[];
}

const HEAD = 'self-start leading-none text-gray-600';
const NUM = '[font-variant-numeric:tabular-nums]';

/**
 * 列見出し・便・運行終了を 1 つのグリッドに置き、全行で列の左端を揃える。
 * 横型と縦型の寸法の違いはすべて`portrait:`で切り替える
 */
export function SignageBusInfo({ boards }: SignageBusInfoProps) {
  return (
    <div className="flex h-[144px] w-[528px] flex-col items-start gap-[2px] overflow-clip rounded-[16px] border border-solid border-gray-200 bg-white px-4 py-[6px] portrait:h-[363px] portrait:w-[1032px] portrait:justify-center portrait:gap-1 portrait:px-6 portrait:py-3">
      <div className="flex items-center gap-2 overflow-clip text-[18px] leading-none whitespace-nowrap text-text portrait:text-[24px]">
        <SignageIcon name="directions_bus" />
        <span className="font-bold">バス発車案内</span>
        <span className="text-gray-600">荒牧キャンパスエリア</span>
      </div>
      <div
        data-testid="bus-grid"
        className="grid w-full grid-cols-[max-content_max-content_minmax(0,1fr)_max-content] gap-x-2 gap-y-1 portrait:gap-x-3 portrait:gap-y-2"
      >
        <span
          className={`${HEAD} text-[12px] whitespace-nowrap portrait:text-[18px]`}
        >
          発車時刻
        </span>
        <span
          className={`${HEAD} text-[12px] whitespace-nowrap portrait:text-[18px]`}
        >
          系統
        </span>
        <span className={`${HEAD} text-[12px] portrait:text-[18px]`}>
          行先・のりば
        </span>
        <span className={`${HEAD} text-right text-[12px] portrait:text-[18px]`}>
          発車まで
        </span>
        {boards.flatMap((board) =>
          board.departures.length === 0
            ? [
                <div
                  key={board.direction}
                  data-testid="bus-departure-ended"
                  className="contents"
                >
                  <span className="col-span-3 col-start-2 flex h-[38px] items-center text-[20px] leading-none text-gray-600 portrait:h-[60px] portrait:text-[32px]">
                    本日の運行は終了しました
                  </span>
                  <span
                    aria-hidden="true"
                    className="col-span-4 hidden h-[60px] portrait:block"
                  />
                </div>,
              ]
            : board.departures.map((d) => (
                <div
                  key={`${board.direction}-${d.route}-${d.scheduledAt}`}
                  data-testid="bus-departure-row"
                  className="contents"
                >
                  <span
                    className={`self-center text-[20px] leading-none font-bold whitespace-nowrap text-text ${NUM} portrait:text-[32px]`}
                  >
                    {d.scheduledAt}
                  </span>
                  <span className="flex items-center justify-center self-center rounded-[4px] bg-primary px-[6px] py-px text-[20px] leading-none font-bold whitespace-nowrap text-text portrait:px-[10px] portrait:py-[2px] portrait:text-[32px]">
                    {d.route}
                  </span>
                  <span className="flex flex-col gap-[2px] self-start overflow-clip">
                    <span className="text-[20px] leading-none font-bold [overflow-wrap:anywhere] text-text portrait:text-[32px]">
                      {d.destination}
                    </span>
                    <span className="text-[14px] leading-none whitespace-nowrap text-gray-600 portrait:text-[22px]">
                      {d.stopName} 発
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-[2px] self-stretch overflow-clip text-right text-warning">
                    <span
                      className={`text-[20px] leading-none font-bold whitespace-nowrap ${NUM} portrait:text-[32px]`}
                    >
                      {d.minutesLeft === 0 ? 'まもなく' : `${d.minutesLeft}分`}
                    </span>
                    {d.delayMinutes > 0 && (
                      <span className="text-[14px] leading-none whitespace-nowrap portrait:text-[22px]">
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
          variant="short"
          timetableFetchedAt={busTimetable.fetchedAt}
        />
      </div>
    </div>
  );
}
