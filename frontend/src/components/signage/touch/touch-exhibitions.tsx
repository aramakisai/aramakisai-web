'use client';

import { useMemo, useState } from 'react';
import { ExhibitionCard } from '@/components/exhibition-card';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  filterExhibitions,
  type ExhibitionCardSummary,
  type ExhibitionCategory,
} from '@/lib/exhibitions';
import { useReportTouchFilters } from './touch-location-reporter';
import { TouchSegment } from './touch-segment';

const CATEGORY_ITEMS = CATEGORY_VALUES.map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
  color: 'bg-primary',
}));

export function TouchExhibitions({
  cards,
}: {
  readonly cards: readonly ExhibitionCardSummary[];
}) {
  const [category, setCategory] = useState<ExhibitionCategory | null>(null);
  useReportTouchFilters(
    useMemo(
      () => ({
        q: '',
        categories: category ? [category] : [],
        areaIds: [],
        page: 1,
      }),
      [category],
    ),
  );
  const shown = filterExhibitions(cards, {
    q: '',
    categories: category ? [category] : [],
    areaIds: [],
    page: 1,
  });

  return (
    <>
      {/* 最後の行を操作の楕円より上へ送れるよう、下端に 240 の余白を置く */}
      <div className="min-h-dvh px-6 pt-6 pb-[240px]">
        {shown.length === 0 ? (
          <p className="text-signage-body">
            {category
              ? '条件に一致する企画はありません'
              : '企画はまだ公開されていません'}
          </p>
        ) : (
          <div className="grid grid-cols-6 items-start gap-6">
            {shown.map((exhibition) => (
              <ExhibitionCard
                key={`${exhibition.id}-${exhibition.category}`}
                exhibition={exhibition}
                variant="signage"
              />
            ))}
          </div>
        )}
      </div>
      {/* 上位文書では y864〜936。iframe は上端 352 から始まるので 512 */}
      <div className="fixed top-[512px] right-6">
        <TouchSegment
          size="page"
          items={CATEGORY_ITEMS}
          value={category}
          onSelect={(v) => setCategory(v as ExhibitionCategory)}
          leading={
            <span className="pl-4 font-display text-[20px] leading-none font-bold text-text">
              カテゴリ
            </span>
          }
        />
      </div>
    </>
  );
}
