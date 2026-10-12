'use client';

import { useEffect, useState } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import { addStamp } from '@/lib/mypage-storage';
import type { StampCategory } from '@/lib/stamp-signature';
import { StampToast, type StampToastKind } from './stamp-toast';

export interface StampCollectorProps {
  readonly exhibitionId: number;
  readonly category: StampCategory;
}

export function StampCollector({
  exhibitionId,
  category,
}: StampCollectorProps) {
  const [kind, setKind] = useState<StampToastKind | null>(null);

  useEffect(() => {
    const signature = new URLSearchParams(window.location.hash.slice(1)).get(
      's',
    );
    if (!signature) return;
    // 成否に関わらず先に消す。再読み込みや URL 共有で検証値が再利用されにくくする
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );

    let cancelled = false;
    fetch('/api/stamps/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: exhibitionId, category, signature }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { valid?: unknown } | null) => {
        if (cancelled || body?.valid !== true) return;
        sendGaEvent('qr_stamp', {
          exhibition_id: exhibitionId,
          exhibition_category: category,
        });
        const result = addStamp(exhibitionId, category);
        if (result !== 'unavailable') setKind(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [exhibitionId, category]);

  return kind ? <StampToast kind={kind} /> : null;
}
