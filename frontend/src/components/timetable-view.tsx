'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import { HoverLineText } from './hover-line';
import { ChevronRightIcon, PlayCircleIcon } from './icons';
import { TimetableGrid } from './timetable-grid';
import {
  STAGE_BAND_CLASSES,
  STAGE_TINT_CLASSES,
} from './timetable-stage-colors';
import { formatEventDayTime, toJstDateKey } from '@/lib/event-day';
import { useNow } from '@/lib/use-now';
import {
  isPerformanceActive,
  resolveInitialDayKey,
  stagesWithPerformances,
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
  // ISR のキャッシュ描画は再検証まで古い日付を初期値にしているため、描画時から日付が
  // 変わっていれば端末の現在日で選び直す
  useEffect(() => {
    const current = new Date();
    if (toJstDateKey(renderedAt) !== toJstDateKey(current.toISOString())) {
      const corrected = resolveInitialDayKey(days, current);
      setDayKey(corrected);
      if (corrected !== initialDayKey) {
        sendGaEvent('timetable', { result: 'date_corrected' });
      }
    }
  }, [days, renderedAt, initialDayKey]);
  const [selectedStageId, setStageId] = useState(stages[0]?.id ?? null);

  if (days.length === 0) {
    return <p className="text-gray-600">{EMPTY_TEXT}</p>;
  }

  const dayPerformances = performances.filter((p) => p.slot.dateKey === dayKey);
  const visibleStages = stagesWithPerformances(stages, dayPerformances);
  // 選択中のステージがその日に無ければ、その日の先頭のステージを選ぶ
  const stageId = visibleStages.some((v) => v.stage.id === selectedStageId)
    ? selectedStageId
    : (visibleStages[0]?.stage.id ?? null);
  const tintClass =
    STAGE_TINT_CLASSES[
      (visibleStages.find((v) => v.stage.id === stageId)?.colorIndex ?? 0) %
        STAGE_TINT_CLASSES.length
    ];
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
            {visibleStages.map(({ stage, colorIndex }) => {
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
                        className={`absolute inset-x-0 -bottom-[2px] h-1 ${STAGE_BAND_CLASSES[colorIndex % STAGE_BAND_CLASSES.length]}`}
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
                  tintClass={tintClass}
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
  tintClass,
}: {
  readonly tintClass: string;
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
        <span className="text-base leading-[1.6]">
          {p.href ? (
            <HoverLineText gap={3}>{p.projectName ?? p.name}</HoverLineText>
          ) : (
            p.name
          )}
        </span>
        {p.projectName && (
          <span className="text-xs leading-[1.4] text-gray-600">{p.name}</span>
        )}
      </span>
      {p.href && <ChevronRightIcon size={20} />}
    </>
  );
  // 強調は塗りを画面幅まで広げ、その分 px を足して文字位置を他の行と揃える
  const row = `group/row flex items-center gap-3 p-4 px-8 text-text`;
  const current = active ? { 'aria-current': 'true' as const } : {};
  return (
    <li
      className={`border-b border-gray-200 -mx-4 ${active ? 'bg-info' : tintClass}`}
    >
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
