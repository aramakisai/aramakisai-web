'use client';

import { useLayoutEffect, useRef } from 'react';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorBackButton } from './regional-sponsor-back-button';
import { RegionalSponsorCard } from './regional-sponsor-card';

export interface RegionalSponsorListProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly initialScrollTop: number;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onSelect: (sponsor: RegionalSponsor) => void;
  readonly emptyMessage?: string;
  /** Figma の見出し・区切り線まわりの間隔は PC パネルと SP シートで異なる */
  readonly variant?: 'panel' | 'sheet';
  /** 指定すると同一座標の企業だけを見せる地点の一覧になる */
  readonly onLocationBack?: () => void;
}

export function RegionalSponsorList({
  sponsors,
  selectedSponsorId,
  initialScrollTop,
  onScrollTopChange,
  onSelect,
  variant = 'panel',
  onLocationBack,
  emptyMessage = '条件に一致する地域協賛はありません。条件を変更してお試しください。',
}: RegionalSponsorListProps) {
  const panel = variant === 'panel';
  const location = onLocationBack !== undefined;
  const titleId = location
    ? 'regional-sponsor-location-list-title'
    : 'regional-sponsor-list-title';
  const scrollRef = useRef<HTMLDivElement>(null);
  // 復元は戻ってきたとき(マウント時)だけ。スクロールのたびに代入し直さない
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = initialScrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-labelledby={titleId}>
      {onLocationBack && (
        <div className={panel ? 'mb-4' : ''}>
          <RegionalSponsorBackButton onBack={onLocationBack} />
        </div>
      )}
      <div
        className={`shrink-0 ${panel ? 'h-16' : ''} ${location && !panel ? 'mt-3' : ''}`}
      >
        <div className="flex h-8 items-center justify-between">
          <h1
            id={titleId}
            tabIndex={-1}
            className="py-0 font-display text-2xl font-extrabold leading-[31.2px] text-text focus:outline-none"
          >
            {location ? (
              <>
                <span aria-hidden="true">地域協賛</span>
                <span className="sr-only">
                  この地点の地域協賛{sponsors.length}件
                </span>
              </>
            ) : (
              '地域協賛'
            )}
          </h1>
          <p
            className="text-sm font-medium leading-[19.6px] text-gray-600"
            // 地点の一覧への切り替えは件数の通知対象にしない
            aria-live={location ? undefined : 'polite'}
            aria-atomic={location ? undefined : 'true'}
            aria-hidden={location ? true : undefined}
          >
            {sponsors.length}件
          </p>
        </div>
      </div>
      <div className={`h-px shrink-0 bg-gray-200 ${panel ? 'mt-4' : 'mt-3'}`} />
      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 ${panel ? 'pt-4' : 'pt-3'}`}
        onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
        data-map-sheet-scroll
        data-testid="regional-sponsor-list-scroll"
      >
        {sponsors.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
            {emptyMessage}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {sponsors.map((sponsor) => (
              <RegionalSponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                selected={sponsor.id === selectedSponsorId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
