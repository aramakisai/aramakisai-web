'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FetchErrorBlock } from '@/components/fetch-error-block';
import { SectionHeading } from '@/components/section-heading';
import { isComplete, type StampRecord } from '@/lib/stamp-aggregate';
import type { MypageStampTarget } from '@/lib/stamp-progress';

// 署名の有効期限 (300 秒) に対し、窓口で提示している最中に切れないよう余裕を持って取り直す
const REFRESH_BEFORE_MS = 60_000;

type State =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly svg: string;
      readonly expiresAt: number;
    }
  | { readonly status: 'error' }
  | { readonly status: 'hidden' };

export interface ExchangeQrPanelProps {
  readonly visitorId: string;
  readonly targets: readonly MypageStampTarget[];
  readonly stamps: readonly StampRecord[];
}

async function issue(visitorId: string): Promise<State> {
  const res = await fetch('/api/stamps/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId }),
    cache: 'no-store',
  });
  if (res.status === 403) return { status: 'hidden' };
  if (!res.ok) return { status: 'error' };
  const body = (await res.json()) as { url?: unknown; expiresAt?: unknown };
  const expiresAt =
    typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : NaN;
  if (typeof body.url !== 'string' || Number.isNaN(expiresAt)) {
    return { status: 'error' };
  }
  const svg = await QRCode.toString(body.url, { type: 'svg', margin: 0 });
  return { status: 'ready', svg, expiresAt };
}

export function ExchangeQrPanel({
  visitorId,
  targets,
  stamps,
}: ExchangeQrPanelProps) {
  const eligible = isComplete(targets, stamps);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    issue(visitorId)
      .catch((): State => ({ status: 'error' }))
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [eligible, visitorId, nonce]);

  const expiresAt = state.status === 'ready' ? state.expiresAt : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const dueAt = expiresAt - REFRESH_BEFORE_MS;
    const timer = setTimeout(
      () => setNonce((n) => n + 1),
      Math.max(0, dueAt - Date.now()),
    );
    // 非表示中はタイマーが止まる端末があるため、復帰時に期限を確かめ直す
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= dueAt) {
        setNonce((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt]);

  if (!eligible || state.status === 'loading' || state.status === 'hidden') {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading level="h2" className="mb-0! text-[20px] leading-[1.3]">
        景品交換
      </SectionHeading>
      {state.status === 'error' ? (
        <FetchErrorBlock
          message="交換用QRを表示できませんでした"
          onReload={() => {
            setState({ status: 'loading' });
            setNonce((n) => n + 1);
          }}
        />
      ) : (
        <>
          <p className="text-base leading-[1.7] text-text">
            交換窓口でこのQRを見せてください
          </p>
          <div className="flex justify-center">
            <div
              role="img"
              aria-label="交換用QR"
              className="size-[174px] [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: state.svg }}
            />
          </div>
        </>
      )}
    </section>
  );
}
