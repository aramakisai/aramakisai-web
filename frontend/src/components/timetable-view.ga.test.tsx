import { render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Timetable } from '@/lib/timetable';

const { sendGaEvent } = vi.hoisted(() => ({ sendGaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));
vi.mock('@/lib/cms', () => ({ cms: {} }));

import { TimetableView } from './timetable-view';

const timetable: Timetable = {
  days: [
    { key: '2026-11-14', label: '11/14 土' },
    { key: '2026-11-15', label: '11/15 日' },
  ],
  stages: [{ id: 1, name: 'A' }],
  performances: [],
} as Timetable;
const renderedAt = new Date('2026-11-14T00:00:00+09:00').toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  sendGaEvent.mockReset();
});
afterEach(() => vi.useRealTimers());

const mount = (initialDayKey: string) =>
  render(
    <TimetableView
      timetable={timetable}
      initialDayKey={initialDayKey}
      renderedAt={renderedAt}
    />,
  );

it('端末の日付で初期日付が変わったときだけ date_corrected を送る', () => {
  vi.setSystemTime(new Date('2026-11-15T10:00:00+09:00'));
  mount('2026-11-14');
  expect(sendGaEvent).toHaveBeenCalledTimes(1);
  expect(sendGaEvent).toHaveBeenCalledWith('timetable', {
    result: 'date_corrected',
  });
});

it('補正しても日付が同じなら送らない', () => {
  vi.setSystemTime(new Date('2026-11-15T10:00:00+09:00'));
  mount('2026-11-15');
  expect(sendGaEvent).not.toHaveBeenCalled();
});

it('日付が変わっていなければ送らない', () => {
  vi.setSystemTime(new Date('2026-11-14T10:00:00+09:00'));
  mount('2026-11-14');
  expect(sendGaEvent).not.toHaveBeenCalled();
});
