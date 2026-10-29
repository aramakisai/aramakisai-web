'use client';

import { useState } from 'react';
import { cancelExchangeRequest } from '@/lib/staff-exchange-api';
import type { ExchangeRecord } from '@/lib/stamp-db';
import { formatJst } from './exchange-list';
import { StaffActionButton } from './staff-action-button';
import { StaffSectionTitle } from './staff-heading';

const BODY = 'text-base leading-[1.7] text-text';

export function ExchangeActions({
  visitorId,
  initialExchange,
  eligible: initialEligible,
}: {
  readonly visitorId: string;
  readonly initialExchange: ExchangeRecord | null;
  readonly eligible: boolean;
}) {
  const [exchange, setExchange] = useState(initialExchange);
  const [eligible, setEligible] = useState(initialEligible);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // 照会時点の署名は再検証しないため、成功の応答だけで状態を持ち替える (ページは再取得しない)
  async function call(
    send: () => Promise<Response>,
    onOk: (exchange: ExchangeRecord) => void,
  ) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await send();
      if (res.status === 409) {
        setEligible(false);
        return;
      }
      if (!res.ok) throw new Error('request failed');
      onOk(((await res.json()) as { exchange: ExchangeRecord }).exchange);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const register = () =>
    call(
      () =>
        fetch('/api/staff/exchanges', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ visitorId }),
        }),
      setExchange,
    );
  const cancel = () =>
    call(
      () => cancelExchangeRequest(exchange!.exchangeId),
      () => setExchange(null),
    );

  return (
    <section className="flex flex-col gap-4">
      <StaffSectionTitle>交換</StaffSectionTitle>
      {failed && (
        <p role="alert" className="text-sm leading-[1.4] text-text">
          処理できませんでした。もう一度お試しください
        </p>
      )}
      {exchange ? (
        <>
          <p className={BODY}>交換済み {formatJst(exchange.exchangedAt)}</p>
          <p className="text-sm leading-[1.4] break-all text-gray-600">
            担当 {exchange.exchangedBy}
          </p>
          <StaffActionButton kind="secondary" disabled={busy} onClick={cancel}>
            取り消す
          </StaffActionButton>
        </>
      ) : eligible ? (
        <>
          <p className={BODY}>未交換</p>
          <StaffActionButton kind="primary" disabled={busy} onClick={register}>
            交換済みにする
          </StaffActionButton>
        </>
      ) : (
        <p className={BODY}>すべての企画のスタンプがそろっていません</p>
      )}
    </section>
  );
}
