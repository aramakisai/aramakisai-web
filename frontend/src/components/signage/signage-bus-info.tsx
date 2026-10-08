import type { DirectionBoard } from '@/lib/bus-departures';
import { SignageIcon } from './signage-parts';

export interface SignageBusInfoProps {
  readonly boards: readonly DirectionBoard[];
}

const DIRECTION_LABEL = {
  maebashi: '前橋駅',
  shibukawa: '渋川駅',
} as const;

/** 縦型は行が増え文字も大きいため、寸法の違いはすべて`portrait:`で切り替える */
export function SignageBusInfo({ boards }: SignageBusInfoProps) {
  return (
    <div className="flex h-[144px] w-[696px] flex-col items-start gap-2 overflow-hidden rounded-[16px] border border-solid border-gray-200 bg-white p-4 portrait:h-[363px] portrait:w-[1032px] portrait:justify-center portrait:gap-[10px] portrait:px-6">
      <div className="flex items-center gap-2 text-[24px] leading-none whitespace-nowrap text-text portrait:text-[32px]">
        <SignageIcon name="directions_bus" />
        <span className="font-display font-bold">バス発車案内</span>
        <span className="text-gray-500">荒牧キャンパスエリア</span>
      </div>
      {boards.flatMap((board) =>
        board.departures.length === 0
          ? [
              <div
                key={board.direction}
                className="flex w-full items-center gap-3 text-[28px] leading-none font-bold text-gray-500 portrait:h-[64px]"
              >
                {DIRECTION_LABEL[board.direction]}
                <span>本日の運行は終了しました</span>
              </div>,
            ]
          : board.departures.map((d) => (
              <div
                key={`${board.direction}-${d.route}-${d.departAt}`}
                className="flex w-full items-center gap-3 overflow-hidden portrait:h-[64px]"
              >
                <span className="flex shrink-0 items-start justify-center rounded-[4px] bg-primary px-3 py-1 text-[24px] leading-none font-bold text-text portrait:w-[80px] portrait:text-[28px]">
                  {d.route}
                </span>
                <span className="text-[28px] leading-none font-bold whitespace-nowrap text-text portrait:text-[36px]">
                  {d.destination}
                </span>
                <span className="font-display text-[36px] leading-none font-extrabold whitespace-nowrap text-text portrait:w-[150px] portrait:text-[48px]">
                  {d.departAt}
                </span>
                <span className="text-[24px] leading-none font-bold whitespace-nowrap text-warning portrait:w-[120px] portrait:text-[28px]">
                  あと{d.minutesLeft}分
                </span>
                <span className="min-w-px flex-1 text-right text-[24px] leading-none text-gray-500 portrait:text-[28px]">
                  {d.stopName}
                </span>
              </div>
            )),
      )}
    </div>
  );
}
