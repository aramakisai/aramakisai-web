'use client';

import { useEffect, useState } from 'react';

import type { EventDay } from './event-day-options';

// 一覧の全行が同じ祭基本情報を読むため、取得は1回にまとめる
let cache: Promise<EventDay[]> | null = null;

function load(): Promise<EventDay[]> {
  cache ??= fetch('/api/globals/festival_meta?depth=0', { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : { event_days: [] }))
    .then((json) => (Array.isArray(json.event_days) ? json.event_days : []))
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

/** null は読み込み中。 */
export function useEventDays(): EventDay[] | null {
  const [days, setDays] = useState<EventDay[] | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setDays(d));
    return () => {
      alive = false;
    };
  }, []);
  return days;
}
