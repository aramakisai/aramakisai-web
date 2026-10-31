'use client';

import { useSyncExternalStore, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookmarkIcon,
  ChevronRightIcon,
  ExpandMoreIcon,
  MaterialIcon,
} from '@/components/icons';
import { DetailColumn } from '@/components/detail-column';
import { ExchangeQrPanel } from '@/components/exchange-qr-panel';
import { FetchErrorBlock } from '@/components/fetch-error-block';
import { HoverLineText } from '@/components/hover-line';
import { SectionHeading } from '@/components/section-heading';
import { ExhibitionCard } from '@/components/exhibition-card';
import type {
  AreaOption,
  ExhibitionCardSummary,
  ExhibitionCategory,
} from '@/lib/exhibitions';
import { useMypageData } from '@/lib/use-mypage-data';
import { useVisitorStamps } from '@/lib/use-visitor-stamps';
import {
  groupStampsByArea,
  type CollectedStamp,
  type MypageStampTarget,
} from '@/lib/stamp-progress';
import type { SavedBookmarkRef } from '@/lib/mypage-storage';
import type { StampCategory } from '@/lib/stamp-signature';

export interface MypageViewProps {
  readonly targets: readonly MypageStampTarget[];
  readonly areas: readonly AreaOption[];
  // exhibitions.ts の実行時 import は CMS クライアントをクライアントバンドルへ引き込むため、サーバー側から受け取る
  readonly categoryLabels: Readonly<Record<ExhibitionCategory, string>>;
  readonly cards: readonly ExhibitionCardSummary[];
}

const BADGE_COLORS: Readonly<Record<StampCategory, string>> = {
  exhibit: 'bg-info',
  vendor: 'bg-warning',
  other: 'bg-accent-alt',
};

function StampRow({
  stamp,
  label,
}: {
  readonly stamp: CollectedStamp;
  readonly label: string;
}) {
  return (
    <Link
      href={`/exhibitions/${stamp.id}/${stamp.category}`}
      className="group/row flex min-h-12 items-center gap-2 py-2.5 pl-4"
    >
      <span className="min-w-0 flex-1 text-base leading-[1.7] text-text">
        <HoverLineText gap={3}>{stamp.displayName}</HoverLineText>
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs leading-[140%] font-medium text-text ${BADGE_COLORS[stamp.category]}`}
      >
        {label}
      </span>
      <ChevronRightIcon size={24} className="shrink-0 text-text" />
    </Link>
  );
}

function AreaHeader({
  name,
  percent,
  expandable,
}: {
  readonly name: string;
  readonly percent: number | null;
  readonly expandable: boolean;
}) {
  return (
    <>
      <div className="flex min-h-6 items-center gap-2">
        <span className="flex-1 font-display text-base leading-[1.4] font-black text-text">
          <HoverLineText gap={5}>{name}</HoverLineText>
        </span>
        {percent !== null && (
          <span className="text-sm leading-[1.4] text-text">{percent}%</span>
        )}
        <span className="size-6 shrink-0">
          {expandable && (
            <ExpandMoreIcon
              size={24}
              className="text-text transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          )}
        </span>
      </div>
      {percent !== null && (
        <div
          aria-hidden="true"
          className="h-1 w-full overflow-hidden rounded-full bg-gray-200"
        >
          <div
            data-testid="progress-fill"
            className="h-full rounded-full bg-accent-alt"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </>
  );
}

const HEADER_CLASS = 'flex flex-col gap-2 py-4';

function StampArea({
  name,
  percent,
  stamps,
  categoryLabels,
}: {
  readonly name: string;
  readonly percent: number | null;
  readonly stamps: readonly CollectedStamp[];
  readonly categoryLabels: MypageViewProps['categoryLabels'];
}) {
  if (stamps.length === 0) {
    return (
      <div className={`${HEADER_CLASS} border-b border-gray-200`}>
        <AreaHeader name={name} percent={percent} expandable={false} />
      </div>
    );
  }
  return (
    <details className="group border-b border-gray-200">
      <summary
        className={`${HEADER_CLASS} group/row cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        <AreaHeader name={name} percent={percent} expandable />
      </summary>
      <div className="border-l-2 border-accent-alt pb-2">
        {stamps.map((s) => (
          <StampRow
            key={`${s.id}:${s.category}`}
            stamp={s}
            label={categoryLabels[s.category]}
          />
        ))}
      </div>
    </details>
  );
}

type TabId = 'stamps' | 'bookmarks';
const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'stamps', label: 'スタンプ' },
  { id: 'bookmarks', label: 'ブックマーク' },
];

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function useSelectedTab(): TabId {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash,
    () => '',
  );
  return hash === '#bookmarks' ? 'bookmarks' : 'stamps';
}

function BookmarkList({
  cards,
  bookmarks,
}: {
  readonly cards: readonly ExhibitionCardSummary[];
  readonly bookmarks: readonly SavedBookmarkRef[];
}) {
  const byKey = new Map(cards.map((c) => [`${c.id}:${c.category}`, c]));
  const items = [...bookmarks]
    .sort((a, b) =>
      a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0,
    )
    .flatMap((b) => byKey.get(`${b.id}:${b.category}`) ?? []);
  if (items.length === 0) {
    return (
      <p className="text-base leading-[1.7] text-gray-600">
        ブックマークはありません
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {items.map((c) => (
        <ExhibitionCard
          key={`${c.id}:${c.category}`}
          exhibition={c}
          bookmarkable
        />
      ))}
    </div>
  );
}

function selectTab(id: TabId) {
  const hash = id === 'bookmarks' ? '#bookmarks' : '';
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  // replaceState は hashchange を発火しないため、購読側へ手で伝える
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event('hashchange'));
}

function onTabKeyDown(e: KeyboardEvent<HTMLElement>, current: TabId) {
  const i = TABS.findIndex((t) => t.id === current);
  let next: number;
  if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
  else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = TABS.length - 1;
  else return;
  e.preventDefault();
  const id = TABS[next].id;
  selectTab(id);
  document.getElementById(`mypage-tab-${id}`)?.focus();
}

export function MypageView({
  targets,
  areas,
  categoryLabels,
  cards,
}: MypageViewProps) {
  // localStorage は hydration 後にしか読めず、読み込み前に空表示を出すと再訪者に誤表示が一瞬出る
  const data = useMypageData();
  const visitorId =
    data === null || data === 'unavailable' ? null : (data.visitorId ?? null);
  const { result: record, reload } = useVisitorStamps(visitorId);
  const saved =
    data === null || record.status !== 'ready'
      ? null
      : record.stamps.map((s) => ({
          id: s.exhibitionId,
          category: s.category,
          savedAt: s.acquiredAt,
        }));
  const bookmarks =
    data === null ? null : data === 'unavailable' ? [] : data.lists.bookmarks;
  const tab = useSelectedTab();

  const { areas: groups, others } = groupStampsByArea(
    targets,
    areas,
    saved ?? [],
  );
  const hasStamps = groups.some((g) => g.collected > 0) || others.length > 0;

  return (
    <DetailColumn>
      <SectionHeading
        level="h1"
        className="mb-0! text-[32px] leading-[1.25] text-text"
      >
        マイページ
      </SectionHeading>

      <p className="hidden text-base leading-[1.7] text-text pc-input:block">
        マイページはスマートフォンでご利用ください
      </p>
      <Image
        src="/images/qr-mypage.svg"
        alt="マイページのQRコード"
        width={174}
        height={174}
        unoptimized
        className="mx-auto hidden size-[174px] pc-input:block"
      />

      <div className="flex flex-col gap-6 pc-input:hidden">
        <div
          role="tablist"
          aria-label="マイページ"
          className="flex h-16 border-b border-gray-200"
        >
          {TABS.map((t) => {
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`mypage-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`mypage-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.id)}
                onKeyDown={(e) => onTabKeyDown(e, tab)}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 overflow-clip text-text"
              >
                {t.id === 'bookmarks' ? (
                  <BookmarkIcon filled={false} />
                ) : (
                  <MaterialIcon name="approval" />
                )}
                <span className="text-[10px] leading-[1.6]">{t.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 bottom-0 h-0.5 bg-accent-alt ${selected ? '' : 'opacity-0'}`}
                />
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id="mypage-panel-stamps"
          aria-labelledby="mypage-tab-stamps"
          hidden={tab !== 'stamps'}
          className="flex flex-col gap-6"
        >
          {record.status === 'error' ? (
            <FetchErrorBlock
              message="スタンプを取得できませんでした"
              onReload={reload}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {saved !== null && !hasStamps && (
                <p className="text-base leading-[1.7] text-gray-600">
                  スタンプはありません
                </p>
              )}
              <div>
                {groups.map((g) => (
                  <StampArea
                    key={g.areaId}
                    name={g.areaName}
                    percent={g.percent}
                    stamps={g.stamps}
                    categoryLabels={categoryLabels}
                  />
                ))}
                {others.length > 0 && (
                  <StampArea
                    name="その他"
                    percent={null}
                    stamps={others}
                    categoryLabels={categoryLabels}
                  />
                )}
              </div>
            </div>
          )}
          {visitorId !== null && record.status === 'ready' && (
            <ExchangeQrPanel
              visitorId={visitorId}
              targets={targets}
              stamps={record.stamps}
            />
          )}
        </div>
        <div
          role="tabpanel"
          id="mypage-panel-bookmarks"
          aria-labelledby="mypage-tab-bookmarks"
          hidden={tab !== 'bookmarks'}
        >
          {bookmarks !== null && (
            <BookmarkList cards={cards} bookmarks={bookmarks} />
          )}
        </div>
      </div>
    </DetailColumn>
  );
}
