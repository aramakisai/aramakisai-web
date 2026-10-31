'use client';

import { BusDataNotice } from './bus-data-notice';
import { isRealtimeFresh, nextBusDepartures } from '@/lib/bus-next-departures';
import type { BusScheduledDeparture } from '@/lib/bus-timetable';
import { useBusRealtime } from '@/lib/use-bus-realtime';
import { useNow } from '@/lib/use-now';

export interface BusDepartureBoardProps {
  /** JST の今日の発車一覧 */
  readonly departures: readonly BusScheduledDeparture[];
  readonly fetchedAt: string;
  /** サーバー描画時刻 (ISO)。初回描画の hydration 一致に使う */
  readonly renderedAt: string;
}

/** 列幅は列見出しと全便で位置を揃えるため固定。SP は 1 段目を 326 幅に収めるため間隔を詰める */
const COLUMN_GAP = 'gap-1 sm:gap-2';

export function BusDepartureBoard({
  departures,
  fetchedAt,
  renderedAt,
}: BusDepartureBoardProps) {
  const now = useNow(renderedAt);
  const realtime = useBusRealtime();
  const boards = nextBusDepartures(departures, realtime, now, 1);
  // リアルタイム情報が古くて使われない場合は生成時刻も出さない
  const generatedAt =
    realtime && isRealtimeFresh(realtime.generatedAt, now)
      ? realtime.generatedAt
      : null;

  return (
    <div
      data-testid="bus-departure-board"
      className="flex w-full flex-col gap-3 rounded-xl border border-solid border-gray-200 p-4"
    >
      <div className="flex items-center gap-2 text-[14px] leading-[normal] whitespace-nowrap text-text">
        <span
          aria-hidden="true"
          className="material-symbols-sharp font-light"
          style={{ fontSize: 'inherit' }}
        >
          directions_bus
        </span>
        <span className="font-bold">バス発車案内</span>
        <span className="text-gray-600">荒牧キャンパスエリア</span>
      </div>
      <div
        className={`flex w-full items-center overflow-clip text-[12px] leading-[normal] text-gray-600 ${COLUMN_GAP}`}
      >
        <span className="w-[52px] shrink-0">発車時刻</span>
        <span className="w-[47px] shrink-0">系統</span>
        <span className="w-[144px] shrink-0">行先・のりば</span>
        <span className="min-w-px flex-1 text-right">発車まで</span>
      </div>
      <div className="flex w-full flex-col gap-2">
        {boards.map((board) => {
          const d = board.departures[0];
          if (!d) {
            return (
              <div
                key={board.direction}
                data-testid="bus-departure-ended"
                className={`flex w-full items-center ${COLUMN_GAP}`}
              >
                <span className="w-[52px] shrink-0" aria-hidden="true" />
                <span className="min-w-px flex-1 text-[16px] leading-[normal] text-gray-600">
                  本日の運行は終了しました
                </span>
              </div>
            );
          }
          return (
            <div
              key={board.direction}
              data-testid="bus-departure-row"
              className={`flex w-full items-center overflow-clip ${COLUMN_GAP}`}
            >
              <span className="w-[52px] shrink-0 text-[16px] leading-[normal] font-bold [font-variant-numeric:tabular-nums] text-text">
                {d.scheduledAt}
              </span>
              <span className="flex w-[47px] shrink-0 items-center justify-center rounded-[4px] bg-primary px-[6px] py-[2px] text-[16px] leading-[normal] font-bold whitespace-nowrap text-text">
                {d.route}
              </span>
              <span className="flex w-[144px] shrink-0 flex-col gap-[2px]">
                <span className="truncate text-[16px] leading-[22px] font-bold text-text">
                  {d.destination}
                </span>
                <span className="text-[12px] leading-[normal] whitespace-nowrap text-gray-600">
                  {d.stopName} 発
                </span>
              </span>
              <span className="flex min-w-px flex-1 flex-col items-end self-stretch justify-center text-right text-warning">
                <span className="text-[16px] leading-[22px] font-bold [font-variant-numeric:tabular-nums]">
                  {d.minutesLeft === 0 ? 'まもなく' : `${d.minutesLeft}分`}
                </span>
                {d.delayMinutes > 0 && (
                  <span className="text-[12px] leading-[normal]">
                    約{d.delayMinutes}分遅れ
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <BusDataNotice
        timetableFetchedAt={fetchedAt}
        realtimeGeneratedAt={generatedAt}
        variant="page"
      />
    </div>
  );
}
