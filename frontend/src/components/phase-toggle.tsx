'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PHASE_OVERRIDE_COOKIE,
  type FestivalPhase,
  type ResolvedPhase,
} from '@/lib/phase';

export interface PhaseToggleProps {
  readonly resolved: ResolvedPhase;
}

const PHASE_LABELS: Record<FestivalPhase, string> = {
  pre_event: '開催前',
  live: '開催中',
};

const OTHER_PHASE: Record<FestivalPhase, FestivalPhase> = {
  pre_event: 'live',
  live: 'pre_event',
};

// Chrome は Cookie の有効期限を発行から 400 日で切り詰めるため、それを上限とする
const OVERRIDE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function PhaseToggle({ resolved }: PhaseToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const otherPhase = OTHER_PHASE[resolved.phase];

  const applyOverride = (phase: FestivalPhase) => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=${phase}; path=/; max-age=${OVERRIDE_MAX_AGE_SECONDS}`;
    router.refresh();
  };

  const clearOverride = () => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=; path=/; max-age=0`;
    router.refresh();
  };

  // 下部ナビゲーション (BottomNavigation) は開催中フェーズかつ 1024px 未満でのみ
  // 表示されるため、同じ条件のときだけこの表示をその上へずらして重なりを避ける
  const bottomClass =
    resolved.phase === 'live'
      ? 'max-lg:bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]'
      : '';

  return (
    <div className={`fixed bottom-4 left-4 z-50 text-sm ${bottomClass}`}>
      {open && (
        <div className="mb-2 flex flex-col gap-2 rounded-md border border-gray-200 bg-background p-3 shadow-card">
          <button
            type="button"
            onClick={() => applyOverride(otherPhase)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-left text-text hover:border-primary"
          >
            {PHASE_LABELS[otherPhase]}に切り替える
          </button>
          {resolved.source === 'override' && (
            <button
              type="button"
              onClick={clearOverride}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-left text-text hover:border-primary"
            >
              オーバーライドを解除する
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="rounded-full border border-gray-200 bg-background px-4 py-2 font-medium text-text shadow-card"
      >
        {PHASE_LABELS[resolved.phase]}
        <span className="ml-1 text-gray-500">
          ({resolved.source === 'override' ? 'オーバーライド' : '定数'})
        </span>
      </button>
    </div>
  );
}
