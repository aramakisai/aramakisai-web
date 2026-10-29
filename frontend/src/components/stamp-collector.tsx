'use client';

import { useEffect, useState } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import { readVisitorId, saveVisitorId } from '@/lib/mypage-storage';
import type { StampCategory } from '@/lib/stamp-signature';
import { StampToast, type StampToastKind } from './stamp-toast';

export interface StampCollectorProps {
  readonly exhibitionId: number;
  readonly category: StampCategory;
}

type VerifyResult = 'added' | 'exists' | 'invalid' | 'failed';

const VERIFY_RESULTS: readonly string[] = [
  'added',
  'exists',
  'invalid',
  'failed',
];

interface ToastState {
  readonly kind: StampToastKind;
  readonly message?: string;
}

const UNAVAILABLE_TOAST: ToastState = {
  kind: 'error',
  message: 'この端末ではスタンプを集められません',
};

export function StampCollector({
  exhibitionId,
  category,
}: StampCollectorProps) {
  const [toast, setToast] = useState<ToastState | null>(null);

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

    const params = {
      exhibition_id: exhibitionId,
      exhibition_category: category,
    };
    const stored = readVisitorId();
    if (stored === 'unavailable') {
      sendGaEvent('qr_stamp', { ...params, result: 'unavailable' });
      setToast(UNAVAILABLE_TOAST);
      return;
    }
    // 端末に保存するのは取得が返ったときだけ。失敗した読み取りで孤立した ID を残さない
    const visitorId = stored ?? crypto.randomUUID();

    fetch('/api/stamps/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: exhibitionId,
        category,
        signature,
        visitorId,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('verify failed');
        return res.json() as Promise<{ result?: unknown } | null>;
      })
      .then((body) => {
        const result: VerifyResult =
          typeof body?.result === 'string' &&
          VERIFY_RESULTS.includes(body.result)
            ? (body.result as VerifyResult)
            : 'invalid';
        sendGaEvent('qr_stamp', { ...params, result });
        if (result === 'failed') {
          setToast({ kind: 'error' });
          return;
        }
        if (result === 'invalid') return;
        if (stored === null) saveVisitorId(visitorId);
        setToast({ kind: result });
      })
      .catch(() => {
        sendGaEvent('qr_stamp', { ...params, result: 'network_error' });
        setToast({ kind: 'error' });
      });
    // 検証値は上で URL から消すため、StrictMode の再実行では送信できない。cleanup で結果を捨てると
    // 開発時に最初の送信の結果が反映されなくなるので、取り消しはしない
  }, [exhibitionId, category]);

  return toast ? <StampToast {...toast} /> : null;
}
