'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRightIcon, PlayCircleIcon } from './icons';
import { TimetableGrid } from './timetable-grid';
import { STAGE_BAND_CLASSES } from './timetable-stage-colors';
import { formatEventDayTime } from '@/lib/event-day';
import { useNow } from '@/lib/use-now';
import {
  isPerformanceActive,
  type Timetable,
  type TimetablePerformance,
} from '@/lib/timetable';

export interface TimetableViewProps {
  readonly timetable: Timetable;
  readonly initialDayKey: string | null;
  readonly renderedAt: string;
}

const EMPTY_TEXT = '出演予定はありません';

export function TimetableView({
  timetable,
  initialDayKey,
  renderedAt,
}: TimetableViewProps) {
  const now = useNow(renderedAt);
  const { days, stages, performances } = timetable;
  const [dayKey, setDayKey] = useState(initialDayKey);
  const [stageId, setStageId] = useState(stages[0]?.id ?? null);

  if (days.length === 0) {
    return <p className="text-gray-600">{EMPTY_TEXT}</p>;
  }

  const dayPerformances = performances.filter((p) => p.slot.dateKey === dayKey);
  const stagePerformances = dayPerformances.filter(
    (p) => p.stageId === stageId,
  );

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div role="group" aria-label="開催日" className="flex flex-wrap gap-2">
        {days.map((day) => {
          const pressed = day.key === dayKey;
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => setDayKey(day.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                pressed
                  ? 'border-primary bg-primary text-text'
                  : 'border-gray-200 bg-background text-text'
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <div className="hidden lg:block">
        {dayPerformances.length > 0 ? (
          <TimetableGrid
            stages={stages}
            performances={dayPerformances}
            now={now}
          />
        ) : (
          <p className="text-gray-600">{EMPTY_TEXT}</p>
        )}
      </div>

      <div className="lg:hidden">
        {/* 両端を画面幅まで広げ、先頭タブの文字 (px-1 + px-3) をコンテンツ左端に揃える */}
        <div className="-mx-4 overflow-x-auto border-b border-gray-200">
          <div className="flex px-1">
            {stages.map((stage, i) => {
              const selected = stage.id === stageId;
              return (
                <button
                  key={stage.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStageId(stage.id)}
                  className={`h-11 shrink-0 px-3 text-sm leading-[1.4] whitespace-nowrap ${
                    selected ? 'font-bold text-text' : 'text-gray-600'
                  }`}
                >
                  <span className="relative">
                    {stage.name}
                    {selected && (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 -bottom-[2px] h-1 ${STAGE_BAND_CLASSES[i % STAGE_BAND_CLASSES.length]}`}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div data-testid="timetable-list">
          {stagePerformances.length > 0 ? (
            <ul>
              {stagePerformances.map((p) => (
                <ListRow
                  key={p.id}
                  performance={p}
                  active={isPerformanceActive(p.slot, now)}
                />
              ))}
            </ul>
          ) : (
            <p className="pt-4 text-gray-600">{EMPTY_TEXT}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ListRow({
  performance: p,
  active,
}: {
  readonly performance: TimetablePerformance;
  readonly active: boolean;
}) {
  const content = (
    <>
      <span className="flex w-16 shrink-0 flex-col gap-0.5 leading-[1.4] tabular-nums">
        <span className="text-base font-bold">
          {formatEventDayTime(p.slot.startAt)}
        </span>
        <span className="text-xs text-gray-600">
          〜{formatEventDayTime(p.slot.endAt)}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {active && (
          <span className="flex items-center gap-0.5 text-xs leading-[1.4]">
            <PlayCircleIcon size={14} />
            出演中
          </span>
        )}
        <span className="text-base leading-[1.6]">{p.name}</span>
      </span>
      {p.href && <ChevronRightIcon size={20} />}
    </>
  );
  // 強調は塗りを画面幅まで広げ、その分 px を足して文字位置を他の行と揃える
  const row = `flex items-center gap-3 p-4 text-text ${active ? 'px-8' : ''}`;
  const current = active ? { 'aria-current': 'true' as const } : {};
  return (
    <li className={`border-b border-gray-200 ${active ? '-mx-4 bg-info' : ''}`}>
      {p.href ? (
        <Link href={p.href} className={row} {...current}>
          {content}
        </Link>
      ) : (
        <div className={row} {...current}>
          {content}
        </div>
      )}
    </li>
  );
}
