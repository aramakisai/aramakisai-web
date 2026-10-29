'use client';

import { useState } from 'react';
import { cancelExchangeRequest } from '@/lib/staff-exchange-api';
import type { ExchangeRecord } from '@/lib/stamp-db';
import { StaffActionButton } from './staff-action-button';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

// Intl の timeZone に頼らず固定オフセットで求め、サーバーとブラウザの描画差を出さない
export function formatJst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const META = 'text-xs leading-[1.4] text-gray-600';

export function ExchangeList({
  initial,
}: {
  readonly initial: readonly ExchangeRecord[];
}) {
  const [rows, setRows] = useState(initial);
  const [pending, setPending] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  async function cancel(id: number) {
    setPending(id);
    setFailed(false);
    try {
      const res = await cancelExchangeRequest(id);
      if (!res.ok) throw new Error('cancel failed');
      const { exchange } = (await res.json()) as { exchange: ExchangeRecord };
      setRows((cur) =>
        cur.map((r) => (r.exchangeId === exchange.exchangeId ? exchange : r)),
      );
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col">
      {failed && (
        <p role="alert" className="pb-2 text-sm leading-[1.4] text-text">
          取り消せませんでした
        </p>
      )}
      {rows.map((r) => (
        <div
          key={r.exchangeId}
          className="flex items-center gap-3 border-b border-gray-200 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-base leading-[1.5] font-bold text-text">
              {r.visitorId.slice(0, 8)}
            </p>
            <p className={`${META} break-all`}>
              {formatJst(r.exchangedAt)} {r.exchangedBy}
            </p>
            {r.cancelledAt !== null && (
              <p className={`${META} break-all`}>
                取り消し済み {formatJst(r.cancelledAt)} {r.cancelledBy}
              </p>
            )}
          </div>
          {r.cancelledAt === null && (
            <StaffActionButton
              kind="secondary"
              className="shrink-0"
              disabled={pending === r.exchangeId}
              onClick={() => cancel(r.exchangeId)}
            >
              取り消す
            </StaffActionButton>
          )}
        </div>
      ))}
    </div>
  );
}
