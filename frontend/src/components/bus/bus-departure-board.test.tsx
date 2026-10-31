import { renderToString } from 'react-dom/server';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { BusRealtime } from '@/lib/use-bus-realtime';
import type { BusScheduledDeparture } from '@/lib/bus-timetable';
import { BusDepartureBoard } from './bus-departure-board';

let realtime: BusRealtime | null = null;
vi.mock('@/lib/use-bus-realtime', () => ({
  useBusRealtime: () => realtime,
}));

const FETCHED = '2026-10-30T10:30:00.000Z';
const jst = (hh: number, mm: number, ss = 0) =>
  new Date(Date.UTC(2026, 10, 14, hh - 9, mm, ss));

const dep = (
  p: Partial<BusScheduledDeparture> & { tripId: string; time: string },
): BusScheduledDeparture => ({
  serviceId: 's',
  route: '22B',
  destination: '前橋駅',
  via: null,
  direction: 'maebashi',
  stop: 'gunma_univ_aramaki',
  stopSequence: 3,
  ...p,
});

const departures = [
  dep({ tripId: 'a', time: '14:20' }),
  dep({ tripId: 'b', time: '15:00' }),
  dep({
    tripId: 'c',
    route: '22A',
    destination: '渋川駅',
    direction: 'shibukawa',
    stop: 'driving_school',
    time: '14:40',
  }),
];

beforeEach(() => {
  vi.useFakeTimers();
  realtime = null;
});
afterEach(() => vi.useRealTimers());

function renderAt(now: Date) {
  vi.setSystemTime(now);
  render(
    <BusDepartureBoard
      departures={departures}
      fetchedAt={FETCHED}
      renderedAt={now.toISOString()}
    />,
  );
}

describe('BusDepartureBoard', () => {
  test('行先は省略せず、列見出しと行先列は 9 文字が収まる同じ幅', () => {
    const now = jst(14, 17);
    vi.setSystemTime(now);
    render(
      <BusDepartureBoard
        departures={[
          dep({
            tripId: 'x',
            time: '14:20',
            destination: '道の駅まえばし赤城',
          }),
        ]}
        fetchedAt={FETCHED}
        renderedAt={now.toISOString()}
      />,
    );
    const dest = screen.getByText('道の駅まえばし赤城');
    expect(dest.className).not.toContain('truncate');
    const col = dest.parentElement as HTMLElement;
    expect(col.className).toContain('w-[148px]');
    expect(screen.getByText('行先・のりば').className).toContain('w-[148px]');
  });

  test('方面ごとに次の 1 便を、時刻・系統・行先・正式なのりば名・発車までで出す', () => {
    renderAt(jst(14, 17));
    const rows = screen.getAllByTestId('bus-departure-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('14:20')).not.toBeNull();
    expect(within(rows[0]).getByText('22B')).not.toBeNull();
    expect(within(rows[0]).getByText('前橋駅')).not.toBeNull();
    expect(within(rows[0]).getByText('群馬大学荒牧 発')).not.toBeNull();
    expect(within(rows[0]).getByText('3分')).not.toBeNull();
    expect(within(rows[1]).getByText('渋川駅')).not.toBeNull();
    expect(within(rows[1]).getByText('前橋自動車教習所前 発')).not.toBeNull();
    expect(within(rows[1]).getByText('23分')).not.toBeNull();
    expect(screen.queryByText(/約\d+分遅れ/)).toBeNull();
  });

  test('遅れは発車時刻を定刻のまま、発車までを遅れ込みで出し「約N分遅れ」を添える', () => {
    realtime = {
      tripUpdates: new Map([
        ['a', { tripId: 'a', stopSequence: 3, delaySeconds: 300 }],
      ]),
      vehicles: new Map(),
      generatedAt: jst(14, 17).getTime() / 1000,
      tripUpdatesAt: jst(14, 17).getTime() / 1000,
      vehiclesAt: jst(14, 17).getTime() / 1000,
    };
    renderAt(jst(14, 17));
    const row = screen.getAllByTestId('bus-departure-row')[0];
    expect(within(row).getByText('14:20')).not.toBeNull();
    expect(within(row).getByText('8分')).not.toBeNull();
    expect(within(row).getByText('約5分遅れ')).not.toBeNull();
  });

  test('発車予定を過ぎて未発車の便は「まもなく」', () => {
    realtime = {
      tripUpdates: new Map([
        ['a', { tripId: 'a', stopSequence: 3, delaySeconds: 300 }],
      ]),
      vehicles: new Map([
        ['a', { tripId: 'a', currentStopSequence: 3, status: 'stopped_at' }],
      ]),
      generatedAt: jst(14, 26).getTime() / 1000,
      tripUpdatesAt: jst(14, 26).getTime() / 1000,
      vehiclesAt: jst(14, 26).getTime() / 1000,
    };
    renderAt(jst(14, 26));
    expect(screen.queryByText('まもなく')).not.toBeNull();
  });

  test('全便発車済みの方面は運行終了の行を出す', () => {
    renderAt(jst(14, 50));
    expect(screen.getAllByText('本日の運行は終了しました')).toHaveLength(1);
    expect(screen.getAllByTestId('bus-departure-row')).toHaveLength(1);
    expect(screen.queryByText('15:00')).not.toBeNull();
  });

  test('時刻が進むと再読み込みなしに次の便へ進む', () => {
    renderAt(jst(14, 17));
    expect(screen.queryByText('14:20')).not.toBeNull();
    act(() => {
      vi.setSystemTime(jst(14, 21));
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByText('14:20')).toBeNull();
    expect(screen.queryByText('15:00')).not.toBeNull();
  });

  test('初回描画はサーバー描画時刻で判定し、時刻表の取得日時には依存しない', () => {
    vi.setSystemTime(jst(14, 50));
    const html = renderToString(
      <BusDepartureBoard
        departures={departures}
        fetchedAt={FETCHED}
        renderedAt={jst(14, 17).toISOString()}
      />,
    );
    expect(html).toContain('14:20');
  });

  test('5 分以上古いリアルタイム情報の生成時刻は出さない', () => {
    realtime = {
      tripUpdates: new Map(),
      vehicles: new Map(),
      generatedAt: jst(14, 10).getTime() / 1000,
      tripUpdatesAt: jst(14, 10).getTime() / 1000,
      vehiclesAt: jst(14, 10).getTime() / 1000,
    };
    renderAt(jst(14, 17));
    expect(screen.queryByText(/遅延情報の生成時刻/)).toBeNull();
  });

  test('列見出しと出典を出す', () => {
    renderAt(jst(14, 17));
    for (const t of ['発車時刻', '系統', '行先・のりば', '発車まで']) {
      expect(screen.queryByText(t)).not.toBeNull();
    }
    expect(screen.queryByTestId('bus-data-notice')).not.toBeNull();
    expect(
      screen.queryByText('時刻表の取得日時: 2026/10/30 19:30'),
    ).not.toBeNull();
  });
});
