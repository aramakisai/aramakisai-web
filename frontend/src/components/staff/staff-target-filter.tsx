'use client';

import { useState } from 'react';
import { SearchIcon } from '@/components/icons';
import { CATEGORY_LABELS, normalizeText } from '@/lib/exhibitions';
import type { AreaStat, TargetStat } from '@/lib/stamp-aggregate';
import type { StampCategory } from '@/lib/stamp-signature';

const BADGE_COLORS: Readonly<Record<StampCategory, string>> = {
  exhibit: 'bg-info',
  vendor: 'bg-warning',
  other: 'bg-accent-alt',
};

const CATEGORIES: readonly StampCategory[] = ['exhibit', 'vendor', 'other'];

const percent = (rate: number) => Math.round(rate * 100);

function Chip({
  pressed,
  onClick,
  children,
}: {
  readonly pressed: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium hover-card-shadow ${
        pressed
          ? 'border-primary bg-primary text-text'
          : 'border-gray-200 bg-background text-text'
      }`}
    >
      {children}
    </button>
  );
}

export function StaffTargetFilter({
  targets,
  areas,
}: {
  readonly targets: readonly TargetStat[];
  readonly areas: readonly AreaStat[];
}) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<StampCategory | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);

  const q = normalizeText(keyword.trim());
  const shown = targets.filter(
    (t) =>
      (category === null || t.category === category) &&
      (areaId === null || t.areaId === areaId) &&
      (q === '' ||
        normalizeText(t.displayName).includes(q) ||
        normalizeText(t.organizationName).includes(q)),
  );
  const areaOptions = areas.filter((a) => a.areaId !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-4 pb-2">
        <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-3 focus-within:border-primary">
          <SearchIcon size={20} className="text-text" />
          <input
            type="search"
            role="searchbox"
            aria-label="企画を検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="企画名・団体名で検索"
            className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
          />
        </label>
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label="カテゴリで絞り込み"
            className="flex flex-col gap-2"
          >
            <span className="text-sm leading-[1.4] font-bold text-text">
              カテゴリ
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  pressed={category === c}
                  onClick={() => setCategory(category === c ? null : c)}
                >
                  {CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>
          </div>
          {areaOptions.length > 0 && (
            <div
              role="group"
              aria-label="エリアで絞り込み"
              className="flex flex-col gap-2"
            >
              <span className="text-sm leading-[1.4] font-bold text-text">
                エリア
              </span>
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((a) => (
                  <Chip
                    key={a.areaId}
                    pressed={areaId === a.areaId}
                    onClick={() =>
                      setAreaId(areaId === a.areaId ? null : a.areaId)
                    }
                  >
                    {a.areaName}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="text-sm leading-[1.6] text-gray-600">
          {shown.length === 0
            ? '条件に一致する企画はありません'
            : `全 ${shown.length} 件`}
        </p>
      </div>
      <div>
        {shown.map((t) => (
          <div
            key={`${t.exhibitionId}:${t.category}`}
            className="flex items-center gap-3 border-b border-gray-200 py-4"
          >
            <span
              className={`rounded-full px-3 py-1 text-xs leading-[1.4] text-text ${BADGE_COLORS[t.category]}`}
            >
              {CATEGORY_LABELS[t.category]}
            </span>
            <p className="min-w-0 flex-1 text-base leading-[1.7] text-text">
              {t.displayName}
            </p>
            <p className="shrink-0 text-sm leading-[1.4] text-text">
              {t.visitorCount}台 {percent(t.rate)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
