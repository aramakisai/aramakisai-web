'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

export interface UserLocation {
  readonly latitude: number;
  readonly longitude: number;
  /** 95%信頼の半径(メートル) */
  readonly accuracy: number;
}

export type UserLocationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'watching'; readonly location: UserLocation | null };

export interface UseUserLocationOptions {
  /** 監視を始めてから最初の範囲内の位置で1回だけ呼ぶ */
  readonly onFirstLocation: (location: UserLocation) => void;
}

export type UserLocationFailureReason =
  'out_of_campus' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

interface UserLocationFailure {
  readonly reason: UserLocationFailureReason;
  /** 失敗のたびに増える。同じ理由が続いても変化を検知できる */
  readonly seq: number;
}

// GeolocationPositionError.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
const ERROR_CODE_REASON: Record<number, UserLocationFailureReason> = {
  1: 'denied',
  2: 'unavailable',
  3: 'timeout',
};

export interface UseUserLocationResult {
  readonly state: UserLocationState;
  readonly lastFailure: UserLocationFailure | null;
  readonly start: () => void;
}

export function isWithinCampus(latitude: number, longitude: number): boolean {
  const [[south, west], [north, east]] = CAMPUS_MAP_CONFIG.campusBounds;
  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
}

export function useUserLocation({
  onFirstLocation,
}: UseUserLocationOptions): UseUserLocationResult {
  const [state, setState] = useState<UserLocationState>({ kind: 'idle' });
  const [lastFailure, setLastFailure] = useState<UserLocationFailure | null>(
    null,
  );
  const onFirstRef = useRef(onFirstLocation);
  onFirstRef.current = onFirstLocation;
  // 現在の監視の watch ID とセッション ID。clearWatch 前にキューへ積まれた
  // コールバックが後から届いても、セッション不一致で捨てる
  const watchIdRef = useRef<number | null>(null);
  const sessionRef = useRef(0);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const recordFailure = useCallback((reason: UserLocationFailureReason) => {
    setLastFailure((prev) => ({ reason, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const fail = useCallback(
    (reason: UserLocationFailureReason) => {
      stop();
      setState({ kind: 'idle' });
      recordFailure(reason);
    },
    [stop, recordFailure],
  );

  const start = useCallback(() => {
    if (watchIdRef.current !== null) return;
    if (!('geolocation' in navigator)) {
      recordFailure('unsupported');
      return;
    }
    const session = ++sessionRef.current;
    let notified = false;
    setState({ kind: 'watching', location: null });
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (session !== sessionRef.current) return;
        if (!isWithinCampus(coords.latitude, coords.longitude)) {
          fail('out_of_campus');
          return;
        }
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        };
        setState({ kind: 'watching', location });
        if (!notified) {
          notified = true;
          onFirstRef.current(location);
        }
      },
      (error) => {
        if (session !== sessionRef.current) return;
        fail(ERROR_CODE_REASON[error.code] ?? 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [fail, recordFailure]);

  useEffect(() => stop, [stop]);

  return { state, lastFailure, start };
}
