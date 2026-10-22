import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ParkingResponse } from '@/lib/parking';

const { sendGaEvent } = vi.hoisted(() => ({ sendGaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));

import { ParkingList } from './parking-list';

const RENDERED_AT = '2026-11-14T04:00:00Z';
const res = (updatedAt: string): ParkingResponse => ({
  isEventDay: true,
  fetchedAt: '2026-11-14T03:59:00Z',
  lots: [{ id: 1, name: 'P', status: 'available', updatedAt }],
});
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  sendGaEvent.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const tick = () => act(() => vi.advanceTimersByTimeAsync(20_000));
const calls = () => sendGaEvent.mock.calls.map((c) => c[1]);

it('初期データが無いときマウント時に1回 initial_missing を送る', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => res('2026-11-14T03:55:00Z'),
  });
  render(<ParkingList initial={null} renderedAt={RENDERED_AT} />);
  await tick();
  expect(calls().filter((p) => p.result === 'initial_missing')).toHaveLength(1);
});

it('連続失敗でも poll_fail は1回、成功では送らない', async () => {
  fetchMock.mockRejectedValue(new Error('x'));
  render(
    <ParkingList
      initial={res('2026-11-14T03:55:00Z')}
      renderedAt={RENDERED_AT}
    />,
  );
  await tick();
  await tick();
  await tick();
  expect(calls().filter((p) => p.result === 'poll_fail')).toHaveLength(1);
  expect(calls().filter((p) => p.result === 'initial_missing')).toHaveLength(0);
});

it('古い区画があれば stale を件数付きで1回だけ送る', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => res('2026-11-14T02:00:00Z'),
  });
  render(
    <ParkingList
      initial={res('2026-11-14T02:00:00Z')}
      renderedAt={RENDERED_AT}
    />,
  );
  await tick();
  await tick();
  expect(calls().filter((p) => p.result === 'stale')).toEqual([
    { result: 'stale', item_count: 1 },
  ]);
});

it('古い区画が無ければ何も送らない', () => {
  render(
    <ParkingList
      initial={res('2026-11-14T03:55:00Z')}
      renderedAt={RENDERED_AT}
    />,
  );
  expect(sendGaEvent).not.toHaveBeenCalled();
});
