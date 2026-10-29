'use client';

import { useEffect, useState } from 'react';
import type { StampRecord } from './stamp-aggregate';

export type VisitorStamps =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly stamps: readonly StampRecord[] }
  | { readonly status: 'error' };

const NO_STAMPS: readonly StampRecord[] = [];

async function load(visitorId: string): Promise<readonly StampRecord[] | null> {
  const res = await fetch(
    `/api/stamps?visitorId=${encodeURIComponent(visitorId)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { stamps?: unknown };
  return Array.isArray(body.stamps) ? (body.stamps as StampRecord[]) : null;
}

/** 匿名IDが無ければ取得せず、記録なしの ready を返す */
export function useVisitorStamps(visitorId: string | null): {
  readonly result: VisitorStamps;
  readonly reload: () => void;
} {
  const [attempt, setAttempt] = useState(0);
  const key = `${visitorId}:${attempt}`;
  // 結果に取得の鍵を持たせ、匿名IDや再読み込みで鍵が変わった間は loading として扱う
  const [loaded, setLoaded] = useState<{
    readonly key: string;
    readonly stamps: readonly StampRecord[] | null;
  } | null>(null);

  useEffect(() => {
    if (visitorId === null) return;
    let cancelled = false;
    load(visitorId)
      .catch(() => null)
      .then((stamps) => {
        if (!cancelled) setLoaded({ key, stamps });
      });
    return () => {
      cancelled = true;
    };
  }, [visitorId, key]);

  const reload = () => setAttempt((n) => n + 1);
  if (visitorId === null) {
    return { result: { status: 'ready', stamps: NO_STAMPS }, reload };
  }
  if (loaded?.key !== key) return { result: { status: 'loading' }, reload };
  return {
    result: loaded.stamps
      ? { status: 'ready', stamps: loaded.stamps }
      : { status: 'error' },
    reload,
  };
}
