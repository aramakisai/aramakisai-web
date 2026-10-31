// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeTripUpdates, decodeVehicles } from './gtfs-realtime';
import { fetchBusRealtime, useBusRealtime } from './use-bus-realtime';

const fixture = (n: string) => readFileSync(`src/lib/__fixtures__/${n}`);

const ok = (buf: Buffer) => new Response(new Uint8Array(buf), { status: 200 });

function mockFetch(handlers: Record<string, () => Response | Error>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = url.endsWith('trip_update') ? 'trip_update' : 'vehicle';
      const r = handlers[key]();
      if (r instanceof Error) throw r;
      return r;
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchBusRealtime', () => {
  it('2 フィードの生成時刻のうち古い方を返す', async () => {
    mockFetch({
      trip_update: () => ok(fixture('gtfs-rt-trip-update.pb')),
      vehicle: () => ok(fixture('gtfs-rt-vehicle.pb')),
    });
    const r = await fetchBusRealtime();
    const stamps = [
      decodeTripUpdates(new Uint8Array(fixture('gtfs-rt-trip-update.pb'))),
      decodeVehicles(new Uint8Array(fixture('gtfs-rt-vehicle.pb'))),
    ].map((f) => f.generatedAt);
    expect(r.generatedAt).toBe(Math.min(...stamps));
    expect(r.tripUpdates.size).toBeGreaterThan(0);
    expect(r.vehicles.size).toBeGreaterThan(0);
  });

  it('失敗したフィードは空になり、生成時刻は取得できた方になる', async () => {
    mockFetch({
      trip_update: () => new Response('', { status: 500 }),
      vehicle: () => ok(fixture('gtfs-rt-vehicle.pb')),
    });
    const r = await fetchBusRealtime();
    expect(r.tripUpdates.size).toBe(0);
    expect(r.vehicles.size).toBeGreaterThan(0);
    expect(r.generatedAt).not.toBeNull();
  });

  it('デコードに失敗したフィードも空になる', async () => {
    mockFetch({
      trip_update: () => ok(Buffer.from([0xff, 0xff, 0xff])),
      vehicle: () => new Error('network'),
    });
    const r = await fetchBusRealtime();
    expect(r.tripUpdates.size).toBe(0);
    expect(r.vehicles.size).toBe(0);
    expect(r.generatedAt).toBeNull();
  });
});

describe('useBusRealtime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('取得前は null、取得後は値を返し、30 秒後に再取得する', async () => {
    mockFetch({
      trip_update: () => ok(fixture('gtfs-rt-trip-update.pb')),
      vehicle: () => ok(fixture('gtfs-rt-vehicle.pb')),
    });
    const { result } = renderHook(() => useBusRealtime());
    expect(result.current).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
