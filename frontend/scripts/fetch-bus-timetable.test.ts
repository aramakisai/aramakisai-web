import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { activeServiceIds } from '../src/lib/bus-timetable';
import {
  buildTimetableFile,
  extractVersion,
  parseVersionDates,
} from './fetch-bus-timetable';

const csv = (rows: string[][]) => '﻿' + rows.map((r) => r.join(',')).join('\n');

function makeZip(
  stopTimes: string[][],
  trips: string[][],
  feedEnd = '20270918',
  extraDates: string[][] = [],
): Uint8Array {
  return zipSync({
    'feed_info.txt': strToU8(
      csv([
        ['feed_start_date', 'feed_end_date'],
        ['20260919', feedEnd],
      ]),
    ),
    'routes.txt': strToU8(
      csv([
        ['route_id', 'route_long_name'],
        ['r22a', '22A 前橋渋川線'],
      ]),
    ),
    'trips.txt': strToU8(
      csv([
        ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id'],
        ...trips,
      ]),
    ),
    'stop_times.txt': strToU8(
      csv([
        [
          'trip_id',
          'departure_time',
          'stop_id',
          'stop_sequence',
          'stop_headsign',
          'pickup_type',
        ],
        ...stopTimes,
      ]),
    ),
    'calendar.txt': strToU8(
      csv([
        [
          'service_id',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
          'start_date',
          'end_date',
        ],
        ['土曜', '0', '0', '0', '0', '0', '1', '0', '20260919', '20270918'],
        ['日祝', '0', '0', '0', '0', '0', '0', '1', '20260919', '20270918'],
        ['未使用', '1', '1', '1', '1', '1', '0', '0', '20260919', '20270918'],
      ]),
    ),
    'calendar_dates.txt': strToU8(
      csv([
        ['service_id', 'date', 'exception_type'],
        ['土曜', '20261103', '2'],
        ['日祝', '20261103', '1'],
        ['未使用', '20261103', '2'],
        ...extraDates,
      ]),
    ),
  });
}

const trips = [
  ['r22a', '土曜', 't1', '前橋駅', '1'],
  ['r22a', '土曜', 't2', '渋川市内循環右回り', '1'],
  ['r22a', '日祝', 't3', '渋川駅', '0'],
  ['r22a', '未使用', 't4', '前橋駅', '1'],
];

describe('parseVersionDates', () => {
  it('リソース名から日付を重複なく昇順で返す', () => {
    const html =
      '関越交通バス-20261116 x 関越交通バス-20260919 関越交通バス-20260919';
    expect(parseVersionDates(html)).toEqual(['20260919', '20261116']);
  });

  it('1 つも読み取れなければ失敗する', () => {
    expect(() => parseVersionDates('<html></html>')).toThrow();
  });
});

describe('extractVersion', () => {
  const stopTimes = [
    ['t1', '07:10:00', '200273_01', '3', '', '0'],
    [
      't1',
      '07:20:00',
      '200722_02',
      '5',
      '前橋駅（南橘団地・群大病院 経由）',
      '0',
    ],
    ['t2', '08:00:00', '200722_02', '5', '前橋駅', '0'],
    ['t2', '08:30:00', '200273_01', '3', '前橋駅', '1'],
    ['t3', '09:00:00', '200722_01', '2', '渋川駅（渋川市内循環 経由）', '0'],
    ['t4', '10:00:00', '999999_01', '2', '前橋駅', '0'],
  ];

  it('乗車不可を除き、停留所の行先・経由・方面・系統を付ける', () => {
    const v = extractVersion('20260919', makeZip(stopTimes, trips));
    expect(v.validFrom).toBe('2026-09-19');
    expect(v.validTo).toBe('2027-09-18');
    expect(v.departures).toEqual([
      {
        tripId: 't1',
        serviceId: '土曜',
        route: '22A',
        destination: '前橋駅',
        via: null,
        direction: 'maebashi',
        stop: 'gunma_univ_aramaki',
        stopSequence: 3,
        time: '07:10',
      },
      {
        tripId: 't1',
        serviceId: '土曜',
        route: '22A',
        destination: '前橋駅',
        via: '南橘団地・群大病院',
        direction: 'maebashi',
        stop: 'driving_school',
        stopSequence: 5,
        time: '07:20',
      },
      {
        tripId: 't2',
        serviceId: '土曜',
        route: '22A',
        destination: '前橋駅',
        via: null,
        direction: 'maebashi',
        stop: 'driving_school',
        stopSequence: 5,
        time: '08:00',
      },
      {
        tripId: 't3',
        serviceId: '日祝',
        route: '22A',
        destination: '渋川駅',
        via: '渋川市内循環',
        direction: 'shibukawa',
        stop: 'driving_school',
        stopSequence: 2,
        time: '09:00',
      },
    ]);
  });

  it('対象の発車を持つ運行日区分だけを曜日・期間と例外日つきで書き出す', () => {
    const v = extractVersion('20260919', makeZip(stopTimes, trips));
    expect(v.services).toEqual([
      {
        id: '土曜',
        weekdays: [false, false, false, false, false, true, false],
        startDate: '2026-09-19',
        endDate: '2027-09-18',
        added: [],
        removed: ['2026-11-03'],
      },
      {
        id: '日祝',
        weekdays: [false, false, false, false, false, false, true],
        startDate: '2026-09-19',
        endDate: '2027-09-18',
        added: ['2026-11-03'],
        removed: [],
      },
    ]);
  });

  it('calendar.txt に無く calendar_dates.txt だけで定義された運行日区分は、追加日だけで運行する', () => {
    const v = extractVersion(
      '20260919',
      makeZip(
        [
          ['t5', '07:00:00', '200273_01', '3', '前橋駅', '0'],
          ['t5', '07:05:00', '200722_01', '4', '前橋駅', '0'],
          ['t5', '07:10:00', '200722_02', '5', '前橋駅', '0'],
        ],
        [['r22a', '年末年始', 't5', '前橋駅', '1']],
        '20270918',
        [
          ['年末年始', '20270102', '1'],
          ['年末年始', '20261230', '1'],
        ],
      ),
    );
    expect(v.services).toEqual([
      {
        id: '年末年始',
        weekdays: [false, false, false, false, false, false, false],
        startDate: '2026-09-19',
        endDate: '2027-09-18',
        added: ['2026-12-30', '2027-01-02'],
        removed: [],
      },
    ]);
    expect([...activeServiceIds(v, '2026-12-30')]).toEqual(['年末年始']);
    expect([...activeServiceIds(v, '2027-01-02')]).toEqual(['年末年始']);
    expect([...activeServiceIds(v, '2027-01-03')]).toEqual([]);
  });

  it('前橋方面で記号表に無い経由が現れたら失敗する', () => {
    const bad = [
      ['t1', '07:10:00', '200273_01', '3', '前橋駅（未知の経由 経由）', '0'],
    ];
    expect(() => extractVersion('20260919', makeZip(bad, trips))).toThrow(
      /未知の経由/,
    );
  });

  it('方面が 0/1 以外なら失敗する', () => {
    const t = [['r22a', '土曜', 't1', '前橋駅', '2']];
    expect(() =>
      extractVersion('20260919', makeZip([stopTimes[0]], t)),
    ).toThrow(/direction_id/);
  });

  it('対象停留所が無ければ失敗する', () => {
    expect(() =>
      extractVersion('20260919', makeZip([stopTimes[5]], trips)),
    ).toThrow(/停留所/);
  });
});

describe('buildTimetableFile', () => {
  const v = (version: string, validTo: string) => ({
    version,
    validFrom: '2026-09-19',
    validTo,
    services: [],
    departures: [],
  });

  it('有効期間が今日より前に終わった版を除く', () => {
    const f = buildTimetableFile(
      [v('a', '2026-10-30'), v('b', '2027-01-01')],
      null,
      '2026-10-31',
      'T',
    );
    expect(f.versions.map((x) => x.version)).toEqual(['b']);
  });

  it('版の内容が同じなら取得日時を据え置く', () => {
    const prev = { fetchedAt: 'OLD', versions: [v('b', '2027-01-01')] };
    expect(
      buildTimetableFile([v('b', '2027-01-01')], prev, '2026-10-31', 'NEW')
        .fetchedAt,
    ).toBe('OLD');
    expect(
      buildTimetableFile([v('c', '2027-01-01')], prev, '2026-10-31', 'NEW')
        .fetchedAt,
    ).toBe('NEW');
  });

  it('全版が期限切れなら失敗する', () => {
    expect(() =>
      buildTimetableFile([v('a', '2026-10-30')], null, '2026-10-31', 'T'),
    ).toThrow();
  });
});
