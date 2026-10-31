import { describe, it, expect } from 'vitest';
import {
  nextBusDepartures,
  type BusRealtimeInput,
} from './bus-next-departures';
import type { BusScheduledDeparture } from './bus-timetable';

// JST 2026-11-14(土)
const sat = (hh: number, mm: number, ss = 0) =>
  new Date(Date.UTC(2026, 10, 14, hh - 9, mm, ss));

const dep = (
  p: Partial<BusScheduledDeparture> & { tripId: string; time: string },
): BusScheduledDeparture => ({
  serviceId: 's',
  route: '22A',
  destination: '前橋駅',
  via: null,
  direction: 'maebashi',
  stop: 'driving_school',
  stopSequence: 5,
  ...p,
});

const list = [
  dep({ tripId: 'a', time: '10:00' }),
  dep({
    tripId: 'b',
    route: '22H',
    time: '10:10',
    stop: 'gunma_univ_aramaki',
    stopSequence: 3,
  }),
  dep({ tripId: 'b', route: '22H', time: '10:12', stopSequence: 5 }),
  dep({ tripId: 'c', time: '10:30' }),
  dep({
    tripId: 'd',
    direction: 'shibukawa',
    destination: '渋川駅',
    time: '10:05',
  }),
];

const rt = (
  over: {
    updates?: [string, number, number][];
    vehicles?: [string, number][];
    generatedAt?: number | null;
  },
  now: Date,
): BusRealtimeInput => ({
  tripUpdates: new Map(
    (over.updates ?? []).map(([tripId, stopSequence, delaySeconds]) => [
      tripId,
      { tripId, stopSequence, delaySeconds },
    ]),
  ),
  vehicles: new Map(
    (over.vehicles ?? []).map(([tripId, currentStopSequence]) => [
      tripId,
      { tripId, currentStopSequence, status: 'in_transit_to' as const },
    ]),
  ),
  generatedAt:
    over.generatedAt === undefined
      ? Math.floor(now.getTime() / 1000) - 10
      : over.generatedAt,
});

const first = (now: Date, r: BusRealtimeInput | null, dir = 0) =>
  nextBusDepartures(list, r, now, 1)[dir].departures[0];

describe('nextBusDepartures', () => {
  it('前橋駅方面・渋川駅方面の順で返す', () => {
    expect(
      nextBusDepartures(list, null, sat(9, 0), 1).map((b) => b.direction),
    ).toEqual(['maebashi', 'shibukawa']);
  });

  it('リアルタイム情報なしは時刻表どおり(source=schedule、切り上げ)', () => {
    expect(first(sat(9, 50, 1), null)).toMatchObject({
      route: '22A',
      scheduledAt: '10:00',
      expectedAt: '10:00',
      delayMinutes: 0,
      source: 'schedule',
      minutesLeft: 10,
      stopName: '前橋自動車教習所前',
    });
  });

  it('時刻を過ぎた便は出さない', () => {
    expect(first(sat(10, 0), null).route).toBe('22H');
  });

  it('遅れの情報だけある便は発車予定に遅れを足す', () => {
    const now = sat(9, 50);
    const d = first(now, rt({ updates: [['a', 5, 300]] }, now));
    expect(d).toMatchObject({
      scheduledAt: '10:00',
      expectedAt: '10:05',
      delayMinutes: 5,
      source: 'realtime',
      minutesLeft: 15,
    });
  });

  it('早着は遅れ 0 で時刻表どおりの発車予定', () => {
    const now = sat(9, 50);
    expect(first(now, rt({ updates: [['a', 5, -120]] }, now))).toMatchObject({
      expectedAt: '10:00',
      delayMinutes: 0,
      minutesLeft: 10,
    });
  });

  it('遅れ込みの発車予定までは残し、その時刻で外す', () => {
    const now = sat(10, 2, 30);
    const d = first(now, rt({ updates: [['a', 5, 180]] }, now));
    expect(d.route).toBe('22A');
    expect(d.minutesLeft).toBe(1);
    const later = sat(10, 3, 0);
    expect(first(later, rt({ updates: [['a', 5, 180]] }, later)).route).toBe(
      '22H',
    );
  });

  it('車両が対象停留所を過ぎていれば時刻前でも発車済み', () => {
    const now = sat(9, 50);
    const d = first(now, rt({ vehicles: [['a', 6]] }, now));
    expect(d.route).toBe('22H');
  });

  it('車両が対象停留所を過ぎていなければ時刻を過ぎても残す(minutesLeft=0)', () => {
    const now = sat(10, 1);
    const d = first(now, rt({ vehicles: [['a', 4]] }, now));
    expect(d).toMatchObject({
      route: '22A',
      minutesLeft: 0,
      source: 'schedule',
    });
  });

  it('TripUpdate の stop_sequence が対象停留所より大きければ発車済み', () => {
    const now = sat(9, 50);
    expect(first(now, rt({ updates: [['a', 6, 0]] }, now)).route).toBe('22H');
  });

  it('同じ便が 2 停留所に停まるとき、発車済みでない最初の停車を採る', () => {
    const now = sat(10, 1);
    expect(first(now, null)).toMatchObject({
      route: '22H',
      stopName: '群馬大学荒牧',
    });
    const t = sat(10, 11);
    expect(first(t, null)).toMatchObject({
      route: '22H',
      stopName: '前橋自動車教習所前',
      scheduledAt: '10:12',
    });
    const v = sat(10, 5);
    expect(first(v, rt({ vehicles: [['b', 4]] }, v))).toMatchObject({
      stopName: '前橋自動車教習所前',
    });
  });

  it('生成時刻が 5 分以上前のリアルタイム情報は使わない', () => {
    const now = sat(9, 50);
    const stale = Math.floor(now.getTime() / 1000) - 300;
    const d = first(
      now,
      rt({ updates: [['a', 5, 300]], generatedAt: stale }, now),
    );
    expect(d).toMatchObject({ expectedAt: '10:00', source: 'schedule' });
    const fresh = Math.floor(now.getTime() / 1000) - 299;
    expect(
      first(now, rt({ updates: [['a', 5, 300]], generatedAt: fresh }, now))
        .source,
    ).toBe('realtime');
  });

  it('全便発車済みの方面は空', () => {
    for (const b of nextBusDepartures(list, null, sat(11, 0), 2))
      expect(b.departures).toEqual([]);
  });

  it('指定件数だけ時刻順で返す', () => {
    expect(
      nextBusDepartures(list, null, sat(9, 0), 2)[0].departures.map(
        (d) => d.scheduledAt,
      ),
    ).toEqual(['10:00', '10:10']);
  });
});
