'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRightIcon, ExpandMoreIcon } from '@/components/icons';
import { DetailColumn } from '@/components/detail-column';
import { SectionHeading } from '@/components/section-heading';
import type { AreaOption } from '@/lib/exhibitions';
import { readMypageData, type SavedExhibitionRef } from '@/lib/mypage-storage';
import {
  groupStampsByArea,
  type CollectedStamp,
  type MypageStampTarget,
} from '@/lib/stamp-progress';
import type { StampCategory } from '@/lib/stamp-signature';

export interface MypageViewProps {
  readonly targets: readonly MypageStampTarget[];
  readonly areas: readonly AreaOption[];
  // exhibitions.ts の実行時 import は CMS クライアントをクライアントバンドルへ引き込むため、サーバー側から受け取る
  readonly categoryLabels: Readonly<Record<StampCategory, string>>;
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
      className="flex min-h-12 items-center gap-2 py-2.5 pl-4"
    >
      <span className="min-w-0 flex-1 text-base leading-[1.7] text-text">
        {stamp.displayName}
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
        <span className="flex-1 font-display text-base leading-[1.4] font-extrabold text-text">
          {name}
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
        className={`${HEADER_CLASS} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
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

export function MypageView({
  targets,
  areas,
  categoryLabels,
}: MypageViewProps) {
  // localStorage は hydration 後にしか読めず、読み込み前に空表示を出すと再訪者に誤表示が一瞬出る
  const [saved, setSaved] = useState<readonly SavedExhibitionRef[] | null>(
    null,
  );
  useEffect(() => {
    setSaved(readMypageData()?.lists.stamps ?? []);
  }, []);

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
        className="hidden size-[174px] pc-input:block"
      />

      <section className="flex flex-col gap-4 pc-input:hidden">
        <SectionHeading
          level="h2"
          className="mb-0! text-[20px] leading-[1.3] text-text"
        >
          スタンプ
        </SectionHeading>
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
      </section>
    </DetailColumn>
  );
}
