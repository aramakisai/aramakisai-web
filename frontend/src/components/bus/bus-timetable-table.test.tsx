import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type {
  BusScheduledDeparture,
  BusService,
  BusTimetableFile,
} from '@/lib/bus-timetable';
import { BusTimetableTable } from './bus-timetable-table';

const SAT: BusService = {
  id: '土曜',
  weekdays: [false, false, false, false, false, true, false],
  startDate: '2026-09-19',
  endDate: '2027-03-31',
  added: [],
  removed: [],
};
const SUN: BusService = {
  ...SAT,
  id: '日祝',
  weekdays: [false, false, false, false, false, false, true],
};

let seq = 0;
// 1 便 = 荒牧 + 教習所前の 2 停車。stops で片方だけにもできる
function trip(
  serviceId: string,
  stops: Partial<Record<'gunma_univ_aramaki' | 'driving_school', string>>,
  via: string | null = null,
  direction: 'maebashi' | 'shibukawa' = 'maebashi',
): BusScheduledDeparture[] {
  const tripId = `t${seq++}`;
  return (['gunma_univ_aramaki', 'driving_school'] as const).flatMap((stop) =>
    stops[stop]
      ? [
          {
            tripId,
            serviceId,
            route: '22A',
            destination: '前橋駅',
            via,
            direction,
            stop,
            stopSequence: 1,
            time: stops[stop]!,
          },
        ]
      : [],
  );
}

function file(
  departures: BusScheduledDeparture[],
  services = [SAT, SUN],
): BusTimetableFile {
  return {
    fetchedAt: '2026-10-30T10:30:00.000Z',
    versions: [
      {
        version: '20260919',
        validFrom: '2026-09-19',
        validTo: '2027-09-18',
        services,
        departures,
      },
    ],
  };
}

// 2026-11-14 は土曜、2026-11-15 は日曜 (JST)
const DAYS = [
  { label: null, startAt: '2026-11-14T00:00:00+09:00', endAt: '' },
  { label: null, startAt: '2026-11-15T00:00:00+09:00', endAt: '' },
];

function rowCells(hour: string): string[] {
  const row = screen.getByRole('row', { name: new RegExp(`^${hour}(\\s|$)`) });
  return within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent ?? '');
}

describe('BusTimetableTable', () => {
  const sameBoth = (t: BusScheduledDeparture[]) => [
    ...t.map((d) => ({ ...d, serviceId: '土曜' })),
    ...t.map((d) => ({ ...d, serviceId: '日祝', tripId: d.tripId + 'b' })),
  ];

  test('前橋方面の発車を 10〜18 時の行に時ごとの分で並べる', () => {
    const t = [
      ...trip('土曜', { driving_school: '10:23' }),
      ...trip('土曜', { driving_school: '10:48' }),
      ...trip('土曜', { driving_school: '10:09' }),
      ...trip('土曜', { driving_school: '08:00' }),
      ...trip('土曜', { driving_school: '12:00' }, null, 'shibukawa'),
    ];
    render(<BusTimetableTable file={file(sameBoth(t))} eventDays={DAYS} />);
    expect(screen.getByText('前橋駅行バス時刻表')).toBeTruthy();
    expect(rowCells('10')).toEqual(['10', '09', '23', '48']);
    expect(rowCells('12')).toEqual(['12', '', '', '']);
    expect(screen.getAllByRole('row')).toHaveLength(1 + 9);
    expect(screen.queryByText(/^08/)).toBeNull();
  });

  test('荒牧に停まる便は荒牧の時刻を下線太字、それ以外は教習所前の時刻を出し 1 便は 1 回だけ載せる', () => {
    const t = [
      ...trip('土曜', { gunma_univ_aramaki: '11:20', driving_school: '11:15' }),
      ...trip('土曜', { driving_school: '11:49' }),
    ];
    render(<BusTimetableTable file={file(sameBoth(t))} eventDays={DAYS} />);
    expect(rowCells('11')).toEqual(['11', '20', '49', '']);
    const bold = screen
      .getByRole('row', { name: /^11\s/ })
      .querySelector('td:nth-child(2)')!;
    expect(bold.className).toMatch(/underline/);
    expect(bold.className).toMatch(/font-bold/);
    const plain = screen
      .getByRole('row', { name: /^11\s/ })
      .querySelector('td:nth-child(3)')!;
    expect(plain.className).not.toMatch(/underline/);
  });

  test('経由の記号を付け、凡例を表の下に出す', () => {
    const t = [
      ...trip('土曜', { driving_school: '10:57' }, '南橘団地・群大病院'),
      ...trip('土曜', { driving_school: '10:58' }, '群馬大学荒牧・群大病院'),
      ...trip('土曜', { driving_school: '10:59' }, '南橘団地'),
      ...trip('土曜', { driving_school: '10:10' }, '前橋駅・南橘団地'),
      ...trip('土曜', { driving_school: '10:20' }, '群馬大学荒牧'),
    ];
    render(<BusTimetableTable file={file(sameBoth(t))} eventDays={DAYS} />);
    expect(rowCells('10').slice(1)).toEqual(['△10', '20', '◯57', '☆58', '△59']);
    expect(
      screen.getByText(
        '下線太字は群馬大学荒牧発、それ以外は前橋自動車教習所前発',
      ),
    ).toBeTruthy();
    expect(screen.getByText('◯ 南橘団地・群大病院経由')).toBeTruthy();
    expect(screen.getByText('☆ 群大病院経由')).toBeTruthy();
    expect(screen.getByText('△ 南橘団地経由')).toBeTruthy();
  });

  test('両日の発車が同じなら 1 つの表にまとめ、見出しに両日を書く', () => {
    const t = [...trip('土曜', { driving_school: '10:23' })];
    render(<BusTimetableTable file={file(sameBoth(t))} eventDays={DAYS} />);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('11月14日(土)・11月15日(日)')).toBeTruthy();
  });

  test('発車が違えば日ごとに表を分ける', () => {
    const t = [
      ...trip('土曜', { driving_school: '10:23' }),
      ...trip('日祝', { driving_school: '10:40' }),
    ];
    render(<BusTimetableTable file={file(t)} eventDays={DAYS} />);
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByText('11月14日(土)')).toBeTruthy();
    expect(screen.getByText('11月15日(日)')).toBeTruthy();
  });

  test('その日に合う版が無ければ表を出さない', () => {
    const { container } = render(
      <BusTimetableTable
        file={{ fetchedAt: '2026-10-30T10:30:00.000Z', versions: [] }}
        eventDays={DAYS}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
