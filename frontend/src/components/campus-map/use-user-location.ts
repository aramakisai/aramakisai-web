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

export interface UseUserLocationResult {
  readonly state: UserLocationState;
  readonly failureCount: number;
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
  const [failureCount, setFailureCount] = useState(0);
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

  const fail = useCallback(() => {
    stop();
    setState({ kind: 'idle' });
    setFailureCount((n) => n + 1);
  }, [stop]);

  const start = useCallback(() => {
    if (watchIdRef.current !== null) return;
    if (!('geolocation' in navigator)) {
      setFailureCount((n) => n + 1);
      return;
    }
    const session = ++sessionRef.current;
    let notified = false;
    setState({ kind: 'watching', location: null });
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (session !== sessionRef.current) return;
        if (!isWithinCampus(coords.latitude, coords.longitude)) {
          fail();
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
      () => {
        if (session !== sessionRef.current) return;
        fail();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [fail]);

  useEffect(() => stop, [stop]);

  return { state, failureCount, start };
}
