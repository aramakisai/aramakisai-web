import { describe, it, expect } from 'vitest';
import {
  nextDepartures,
  serviceDayOf,
  type BusTimetable,
  type BusTrip,
} from './bus-departures';
import { BUS_TIMETABLE } from './bus-timetable-data';

// JST 2026-11-14(土) の hh:mm:ss
const sat = (hh: number, mm: number, ss = 0) =>
  new Date(Date.UTC(2026, 10, 14, hh - 9, mm, ss));

const trip = (
  direction: BusTrip['direction'],
  route: string,
  departures: BusTrip['departures'],
): BusTrip => ({
  route,
  destination: direction === 'maebashi' ? '前橋駅' : '渋川駅',
  direction,
  departures,
});

const fixture: BusTimetable = {
  revision: 'test',
  holiday: [
    trip('maebashi', '22A', [{ stop: 'driving_school', time: '10:00' }]),
    trip('maebashi', '22H', [
      { stop: 'gunma_univ_aramaki', time: '10:10' },
      { stop: 'driving_school', time: '10:12' },
    ]),
    trip('maebashi', '22B', [{ stop: 'driving_school', time: '10:30' }]),
    trip('shibukawa', '22A', [{ stop: 'driving_school', time: '10:05' }]),
  ],
};

describe('serviceDayOf', () => {
  it('土日は holiday、それ以外は weekday', () => {
    expect(serviceDayOf(sat(12, 0))).toBe('holiday');
    expect(serviceDayOf(new Date('2026-11-15T03:00:00Z'))).toBe('holiday');
    expect(serviceDayOf(new Date('2026-11-16T03:00:00Z'))).toBe('weekday');
  });

  it('端末のタイムゾーンでなく JST の曜日で判定する', () => {
    // UTC では金曜 16:00 だが JST では土曜 01:00
    expect(serviceDayOf(new Date('2026-11-13T16:00:00Z'))).toBe('holiday');
  });
});

describe('nextDepartures', () => {
  it('前橋駅方面・渋川駅方面の順で返す', () => {
    const boards = nextDepartures(fixture, sat(9, 0), 1);
    expect(boards.map((b) => b.direction)).toEqual(['maebashi', 'shibukawa']);
  });

  it('発車時刻ちょうどの便は出さず次の便を返す', () => {
    const [m] = nextDepartures(fixture, sat(10, 0), 1);
    expect(m.departures[0].route).toBe('22H');
  });

  it('1件 / 2件を指定件数だけ返し、2件目が無ければ1件にとどまる', () => {
    expect(nextDepartures(fixture, sat(9, 0), 2)[0].departures).toHaveLength(2);
    expect(nextDepartures(fixture, sat(9, 0), 1)[0].departures).toHaveLength(1);
    expect(nextDepartures(fixture, sat(9, 0), 2)[1].departures).toHaveLength(1);
  });

  it('両停留所に停まる便は先に来る停車だけを出す', () => {
    const [m] = nextDepartures(fixture, sat(10, 1), 3);
    expect(m.departures.map((d) => [d.route, d.stopName])).toEqual([
      ['22H', '群馬大学荒牧'],
      ['22B', '前橋自動車教習所前'],
    ]);
  });

  it('先の停車が過ぎた便は後の停車を出す', () => {
    const [m] = nextDepartures(fixture, sat(10, 11), 1);
    expect(m.departures[0]).toMatchObject({
      route: '22H',
      stopName: '前橋自動車教習所前',
      departAt: '10:12',
    });
  });

  it('残り分数は切り上げで最小1', () => {
    const at = (h: number, m: number, s: number) =>
      nextDepartures(fixture, sat(h, m, s), 1)[0].departures[0].minutesLeft;
    expect(at(9, 50, 0)).toBe(10);
    expect(at(9, 50, 1)).toBe(10);
    expect(at(9, 59, 30)).toBe(1);
    expect(at(9, 59, 59)).toBe(1);
  });

  it('最終便の後は空を返す', () => {
    for (const b of nextDepartures(fixture, sat(10, 30), 2)) {
      expect(b.departures).toEqual([]);
    }
  });

  it('平日データが無いときは両方面とも空を返す', () => {
    const boards = nextDepartures(fixture, new Date('2026-11-16T01:00:00Z'), 2);
    expect(boards).toHaveLength(2);
    for (const b of boards) expect(b.departures).toEqual([]);
  });
});

describe('BUS_TIMETABLE', () => {
  it('時刻は HH:MM 形式で、方面内の先頭停車が時刻順に並ぶ', () => {
    for (const direction of ['maebashi', 'shibukawa'] as const) {
      const trips = BUS_TIMETABLE.holiday.filter(
        (t) => t.direction === direction,
      );
      expect(trips.length).toBeGreaterThan(0);
      const firsts = trips.map((t) => t.departures[0].time);
      expect(firsts).toEqual([...firsts].sort());
      for (const t of trips) {
        expect(t.departures.length).toBeGreaterThan(0);
        const times = t.departures.map((d) => d.time);
        expect(times).toEqual([...times].sort());
        for (const time of times)
          expect(time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      }
    }
  });
});
