'use client';

import { useRef } from 'react';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorBackButton } from './regional-sponsor-back-button';
import { RegionalSponsorCard } from './regional-sponsor-card';
import { useRestoredMapScroll } from './use-map-scroll-root';
import {
  LIST_TITLE_ID,
  LOCATION_LIST_TITLE_ID,
} from './use-regional-sponsor-map-state';

export interface RegionalSponsorListProps {
  /** PC パネルと SP シートの両方が同じページに描画されるため、id を分ける */
  readonly scope: 'panel' | 'sheet';
  readonly sponsors: readonly RegionalSponsor[];
  readonly initialScrollTop: number;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onSelect: (sponsorId: number) => void;
  readonly emptyMessage?: string;
  /** 指定すると同一座標の企業だけを見せる地点の一覧になる */
  readonly onLocationBack?: () => void;
}

export function RegionalSponsorList({
  scope,
  sponsors,
  initialScrollTop,
  onScrollTopChange,
  onSelect,
  onLocationBack,
  emptyMessage = '条件に一致する地域協賛はありません。条件を変更してお試しください。',
}: RegionalSponsorListProps) {
  const location = onLocationBack !== undefined;
  const baseTitleId = location ? LOCATION_LIST_TITLE_ID : LIST_TITLE_ID;
  const titleId = `${baseTitleId}-${scope}`;
  const sectionRef = useRef<HTMLElement>(null);
  useRestoredMapScroll(sectionRef, initialScrollTop, onScrollTopChange);

  return (
    <section
      ref={sectionRef}
      className="flex flex-col gap-4"
      aria-labelledby={titleId}
      data-testid="regional-sponsor-list-scroll"
    >
      {onLocationBack && <RegionalSponsorBackButton onBack={onLocationBack} />}
      <div className="flex flex-col gap-1">
        <h2
          id={titleId}
          data-focus-id={baseTitleId}
          tabIndex={-1}
          className="text-2xl font-bold text-text focus:outline-none"
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
        </h2>
        <p
          className="text-sm text-gray-600"
          // 地点の一覧への切り替えは件数の通知対象にしない
          aria-live={location ? undefined : 'polite'}
          aria-atomic={location ? undefined : 'true'}
          aria-hidden={location ? true : undefined}
        >
          {sponsors.length}件
        </p>
      </div>
      <span
        data-testid="list-divider"
        aria-hidden="true"
        className="h-px w-full shrink-0 bg-gray-200"
      />
      {sponsors.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <div data-testid="list-cards" className="flex flex-col gap-4">
          {sponsors.map((sponsor) => (
            <RegionalSponsorCard
              key={sponsor.id}
              scope={scope}
              sponsor={sponsor}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
