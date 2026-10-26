import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { isWithinCampus, useUserLocation } from './use-user-location';

type Success = (pos: GeolocationPosition) => void;
type Failure = (err: GeolocationPositionError) => void;

const INSIDE = { lat: 36.4307, lng: 139.0448 };
const OUTSIDE = { lat: 35.0, lng: 139.0 };

let watchPosition: ReturnType<typeof vi.fn>;
let clearWatch: ReturnType<typeof vi.fn>;
let nextId: number;
// watchId -> callbacks
let watchers: Map<number, { ok: Success; ng: Failure }>;

function position(
  lat: number,
  lng: number,
  accuracy = 12,
): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy },
  } as GeolocationPosition;
}
function emit(id: number, lat: number, lng: number, accuracy?: number) {
  act(() => watchers.get(id)!.ok(position(lat, lng, accuracy)));
}
function fail(id: number, code = 1) {
  act(() => watchers.get(id)!.ng({ code } as GeolocationPositionError));
}

beforeEach(() => {
  nextId = 1;
  watchers = new Map();
  watchPosition = vi.fn((ok: Success, ng: Failure) => {
    const id = nextId++;
    watchers.set(id, { ok, ng });
    return id;
  });
  clearWatch = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch },
    configurable: true,
  });
});

describe('isWithinCampus', () => {
  test('内側・境界上・外側', () => {
    expect(isWithinCampus(INSIDE.lat, INSIDE.lng)).toBe(true);
    expect(isWithinCampus(36.42745, 139.04137)).toBe(true);
    expect(isWithinCampus(36.43391, 139.04822)).toBe(true);
    expect(isWithinCampus(36.42744, 139.0448)).toBe(false);
    expect(isWithinCampus(36.4307, 139.04823)).toBe(false);
    expect(isWithinCampus(OUTSIDE.lat, OUTSIDE.lng)).toBe(false);
  });
});

describe('useUserLocation', () => {
  test('マウントだけでは watchPosition を呼ばない', () => {
    const { result } = renderHook(() =>
      useUserLocation({ onFirstLocation: vi.fn() }),
    );
    expect(watchPosition).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: 'idle' });
    expect(result.current.lastFailure).toBeNull();
  });

  test('start で開始し、範囲内の位置で更新、初回通知は1回だけ', () => {
    const onFirstLocation = vi.fn();
    const { result } = renderHook(() => useUserLocation({ onFirstLocation }));
    act(() => result.current.start());
    expect(watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    expect(result.current.state).toEqual({ kind: 'watching', location: null });

    emit(1, INSIDE.lat, INSIDE.lng, 10);
    expect(result.current.state).toEqual({
      kind: 'watching',
      location: { latitude: INSIDE.lat, longitude: INSIDE.lng, accuracy: 10 },
    });
    expect(onFirstLocation).toHaveBeenCalledTimes(1);

    emit(1, INSIDE.lat + 0.0001, INSIDE.lng, 5);
    expect(result.current.state).toMatchObject({
      location: { accuracy: 5 },
    });
    expect(onFirstLocation).toHaveBeenCalledTimes(1);
  });

  test('範囲外の位置で停止し out_of_campus が記録される', () => {
    const onFirstLocation = vi.fn();
    const { result } = renderHook(() => useUserLocation({ onFirstLocation }));
    act(() => result.current.start());
    emit(1, OUTSIDE.lat, OUTSIDE.lng);
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(result.current.state).toEqual({ kind: 'idle' });
    expect(result.current.lastFailure).toEqual({
      reason: 'out_of_campus',
      seq: 1,
    });
    expect(onFirstLocation).not.toHaveBeenCalled();
  });

  test.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('エラー code %i は %s として記録され停止する', (code, reason) => {
    const { result } = renderHook(() =>
      useUserLocation({ onFirstLocation: vi.fn() }),
    );
    act(() => result.current.start());
    fail(1, code);
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(result.current.state).toEqual({ kind: 'idle' });
    expect(result.current.lastFailure).toEqual({ reason, seq: 1 });
  });

  test('geolocation 非対応なら watch せず unsupported が記録される', () => {
    delete (navigator as unknown as Record<string, unknown>).geolocation;
    const { result } = renderHook(() =>
      useUserLocation({ onFirstLocation: vi.fn() }),
    );
    act(() => result.current.start());
    expect(result.current.state).toEqual({ kind: 'idle' });
    expect(result.current.lastFailure).toEqual({
      reason: 'unsupported',
      seq: 1,
    });
  });

  test('watching 中の start では再登録しない', () => {
    const { result } = renderHook(() =>
      useUserLocation({ onFirstLocation: vi.fn() }),
    );
    act(() => result.current.start());
    act(() => result.current.start());
    expect(watchPosition).toHaveBeenCalledTimes(1);
  });

  test('アンマウントで clearWatch する', () => {
    const { result, unmount } = renderHook(() =>
      useUserLocation({ onFirstLocation: vi.fn() }),
    );
    act(() => result.current.start());
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(1);
  });

  test('停止後に古いセッションのコールバックが来ても無視する', () => {
    const onFirstLocation = vi.fn();
    const { result } = renderHook(() => useUserLocation({ onFirstLocation }));
    act(() => result.current.start());
    fail(1);
    expect(result.current.lastFailure?.seq).toBe(1);

    emit(1, INSIDE.lat, INSIDE.lng);
    fail(1);
    expect(result.current.state).toEqual({ kind: 'idle' });
    expect(result.current.lastFailure?.seq).toBe(1);
    expect(onFirstLocation).not.toHaveBeenCalled();

    // 再開した新セッションでは初回通知が再び呼ばれる
    act(() => result.current.start());
    emit(2, INSIDE.lat, INSIDE.lng);
    expect(onFirstLocation).toHaveBeenCalledTimes(1);
  });
});
