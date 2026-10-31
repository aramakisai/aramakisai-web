import { toJstParts } from './event-day';
import type { RealtimeTripUpdate, RealtimeVehicle } from './gtfs-realtime';
import type {
  BusDirection,
  BusScheduledDeparture,
  BusStop,
} from './bus-timetable';

export interface BusRealtimeInput {
  readonly tripUpdates: ReadonlyMap<string, RealtimeTripUpdate>;
  readonly vehicles: ReadonlyMap<string, RealtimeVehicle>;
  /** epoch 秒 */
  readonly generatedAt: number | null;
}

export interface NextDeparture {
  readonly route: string;
  readonly destination: string;
  readonly via: string | null;
  readonly stopName: string;
  readonly scheduledAt: string;
  readonly expectedAt: string;
  /** 早着は 0 */
  readonly delayMinutes: number;
  readonly source: 'realtime' | 'schedule';
  /** 切り上げ。発車予定を過ぎて未発車なら 0 */
  readonly minutesLeft: number;
}

export interface DirectionBoard {
  readonly direction: BusDirection;
  readonly departures: readonly NextDeparture[];
}

const STOP_NAMES: Record<BusStop, string> = {
  gunma_univ_aramaki: '群馬大学荒牧',
  driving_school: '前橋自動車教習所前',
};

const DIRECTIONS: readonly BusDirection[] = ['maebashi', 'shibukawa'];

/** これ以上古いフィードは遅れも車両位置も信用しない */
const STALE_MS = 5 * 60_000;

/** nextBusDepartures が使うのと同じ鮮度判定。表示側の生成時刻の出し分けにも使う */
export function isRealtimeFresh(
  generatedAt: number | null,
  now: Date,
): boolean {
  return generatedAt === null || now.getTime() - generatedAt * 1000 < STALE_MS;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function nextBusDepartures(
  departures: readonly BusScheduledDeparture[],
  realtime: BusRealtimeInput | null,
  now: Date,
  perDirection: number,
): readonly DirectionBoard[] {
  const rt =
    realtime && isRealtimeFresh(realtime.generatedAt, now) ? realtime : null;
  const { hours, minutes } = toJstParts(now.toISOString());
  const nowMs =
    (hours * 60 + minutes) * 60_000 +
    now.getUTCSeconds() * 1000 +
    now.getUTCMilliseconds();

  const byTrip = new Map<string, BusScheduledDeparture[]>();
  for (const d of departures) {
    const stops = byTrip.get(d.tripId);
    if (stops) stops.push(d);
    else byTrip.set(d.tripId, [d]);
  }

  const upcoming: {
    ms: number;
    direction: BusDirection;
    dep: NextDeparture;
  }[] = [];
  for (const [tripId, stops] of byTrip) {
    stops.sort((a, b) => a.stopSequence - b.stopSequence);
    const vehicle = rt?.vehicles.get(tripId);
    const update = rt?.tripUpdates.get(tripId);
    for (const s of stops) {
      const [h, m] = s.time.split(':').map(Number);
      const scheduledMs = (h * 60 + m) * 60_000;
      const delaySeconds = Math.max(0, update?.delaySeconds ?? 0);
      const expectedMs = scheduledMs + delaySeconds * 1000;
      // 車両の位置が分かる便は、時刻を過ぎても停留所を出るまで残す
      const departed = vehicle
        ? vehicle.currentStopSequence > s.stopSequence
        : (update !== undefined && update.stopSequence > s.stopSequence) ||
          nowMs >= expectedMs;
      if (departed) continue;
      const expectedMin = Math.floor(expectedMs / 60_000);
      upcoming.push({
        ms: expectedMs,
        direction: s.direction,
        dep: {
          route: s.route,
          destination: s.destination,
          via: s.via,
          stopName: STOP_NAMES[s.stop],
          scheduledAt: s.time,
          expectedAt: `${pad2(Math.floor(expectedMin / 60))}:${pad2(expectedMin % 60)}`,
          delayMinutes: expectedMin - (h * 60 + m),
          source: update ? 'realtime' : 'schedule',
          minutesLeft: Math.max(0, Math.ceil((expectedMs - nowMs) / 60_000)),
        },
      });
      break;
    }
  }
  upcoming.sort((a, b) => a.ms - b.ms);

  return DIRECTIONS.map((direction) => ({
    direction,
    departures: upcoming
      .filter((u) => u.direction === direction)
      .slice(0, perDirection)
      .map((u) => u.dep),
  }));
}
