import { toJstParts } from './event-day';

export type BusStop = 'gunma_univ_aramaki' | 'driving_school';
export type BusDirection = 'maebashi' | 'shibukawa';
export type ServiceDay = 'weekday' | 'holiday';

export interface BusTrip {
  /** 系統番号。例: "22B" */
  readonly route: string;
  /** 行先の表示名。例: "前橋駅" */
  readonly destination: string;
  readonly direction: BusDirection;
  /** 停車するサイネージ対象停留所と発車時刻 "HH:MM" (JST)。通過・非経由の停留所は含めない */
  readonly departures: readonly {
    readonly stop: BusStop;
    readonly time: string;
  }[];
}

export interface BusTimetable {
  /** 例: "2024-06-01改正 土日祝" */
  readonly revision: string;
  readonly holiday: readonly BusTrip[];
  readonly weekday?: readonly BusTrip[];
}

export interface NextDeparture {
  readonly route: string;
  readonly destination: string;
  readonly stopName: string;
  readonly departAt: string;
  /** 切り上げ。最小1 */
  readonly minutesLeft: number;
}

export interface DirectionBoard {
  readonly direction: BusDirection;
  /** 発車時刻順の次便。本日の便が残っていなければ空 */
  readonly departures: readonly NextDeparture[];
}

const STOP_NAMES: Record<BusStop, string> = {
  gunma_univ_aramaki: '群馬大学荒牧',
  driving_school: '前橋自動車教習所前',
};

const DIRECTIONS: readonly BusDirection[] = ['maebashi', 'shibukawa'];

/** 祝日判定は持たない。開催日(土日)以外は試験表示のみのため */
export function serviceDayOf(now: Date): ServiceDay {
  const { weekday } = toJstParts(now.toISOString());
  return weekday === 0 || weekday === 6 ? 'holiday' : 'weekday';
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function nextDepartures(
  timetable: BusTimetable,
  now: Date,
  perDirection: number,
): readonly DirectionBoard[] {
  const trips = timetable[serviceDayOf(now)] ?? [];
  const { hours, minutes } = toJstParts(now.toISOString());
  const nowMs =
    (hours * 60 + minutes) * 60_000 +
    now.getUTCSeconds() * 1000 +
    now.getUTCMilliseconds();

  return DIRECTIONS.map((direction) => {
    const upcoming: { readonly ms: number; readonly dep: NextDeparture }[] = [];
    for (const trip of trips) {
      if (trip.direction !== direction) continue;
      // 両停留所に停まる便は先に来る停車だけを案内する
      const stop = trip.departures.find(
        (d) => toMinutes(d.time) * 60_000 > nowMs,
      );
      if (!stop) continue;
      const ms = toMinutes(stop.time) * 60_000;
      upcoming.push({
        ms,
        dep: {
          route: trip.route,
          destination: trip.destination,
          stopName: STOP_NAMES[stop.stop],
          departAt: stop.time,
          minutesLeft: Math.max(1, Math.ceil((ms - nowMs) / 60_000)),
        },
      });
    }
    upcoming.sort((a, b) => a.ms - b.ms);
    return {
      direction,
      departures: upcoming.slice(0, perDirection).map((u) => u.dep),
    };
  });
}
