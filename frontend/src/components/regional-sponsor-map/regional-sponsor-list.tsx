'use client';

import { useLayoutEffect, useRef } from 'react';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorCard } from './regional-sponsor-card';

export interface RegionalSponsorListProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly initialScrollTop: number;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onSelect: (sponsor: RegionalSponsor) => void;
  readonly emptyMessage?: string;
}

export function RegionalSponsorList({
  sponsors,
  selectedSponsorId,
  initialScrollTop,
  onScrollTopChange,
  onSelect,
  emptyMessage = '条件に一致する地域協賛はありません。条件を変更してお試しください。',
}: RegionalSponsorListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = initialScrollTop;
  }, [initialScrollTop]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="regional-sponsor-list-title"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200">
        <h1
          id="regional-sponsor-list-title"
          tabIndex={-1}
          className="font-display text-2xl font-extrabold text-text focus:outline-none"
        >
          地域協賛
        </h1>
        <p
          className="text-sm text-gray-600"
          aria-live="polite"
          aria-atomic="true"
        >
          {sponsors.length}件
        </p>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4"
        onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
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
