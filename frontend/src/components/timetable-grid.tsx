import Link from 'next/link';
import { useId } from 'react';
import { ChevronRightIcon, PlayCircleIcon } from './icons';
import { formatEventDayTime, toJstDateKey, toJstParts } from '@/lib/event-day';
import {
  isPerformanceActive,
  type TimetablePerformance,
  type TimetableStage,
} from '@/lib/timetable';
import { STAGE_BAND_CLASSES } from './timetable-stage-colors';

const PX_PER_MINUTE = 4;
const TIME_COL_PX = 68;
const MIN_COL_PX = 240;
// これより短い枠は時刻と名前を1行にまとめる (2行では高さが足りない)
const COMPACT_UNDER_MINUTES = 15;

function minuteOfDay(iso: string): number {
  const { hours, minutes } = toJstParts(iso);
  return hours * 60 + minutes;
}

function hhmm(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export interface TimetableGridProps {
  readonly stages: readonly TimetableStage[];
  /** 選択日の出演枠 (開始時刻順) */
  readonly performances: readonly TimetablePerformance[];
  readonly now: Date;
}

export function TimetableGrid({
  stages,
  performances,
  now,
}: TimetableGridProps) {
  const rangeStart =
    Math.floor(
      Math.min(...performances.map((p) => minuteOfDay(p.slot.startAt))) / 60,
    ) * 60;
  const rangeEnd =
    Math.ceil(
      Math.max(...performances.map((p) => minuteOfDay(p.slot.endAt))) / 60,
    ) * 60;
  const bodyHeight = (rangeEnd - rangeStart) * PX_PER_MINUTE;
  const ticks: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 30) ticks.push(m);

  const nowIso = now.toISOString();
  const nowMinute = minuteOfDay(nowIso);
  const showNow =
    toJstDateKey(nowIso) === performances[0].slot.dateKey &&
    nowMinute >= rangeStart &&
    nowMinute <= rangeEnd;

  return (
    <div data-testid="timetable-grid" className="overflow-x-auto pb-5">
      <div
        className="relative flex"
        style={{ minWidth: TIME_COL_PX + stages.length * MIN_COL_PX }}
      >
        <div
          aria-hidden="true"
          className="relative shrink-0 tabular-nums"
          style={{ width: TIME_COL_PX }}
        >
          {ticks.map((m) => (
            <span
              key={m}
              className="absolute left-0 w-[60px] text-right text-xs leading-[1.4] text-gray-600"
              style={{ top: 48 + (m - rangeStart) * PX_PER_MINUTE }}
            >
              {hhmm(m)}
            </span>
          ))}
        </div>
        <div className="relative flex min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-12"
          >
            {ticks.map((m) => (
              <div
                key={m}
                className={`absolute inset-x-0 border-t border-gray-200 ${m % 60 === 0 ? '' : 'border-dashed'}`}
                style={{ top: (m - rangeStart) * PX_PER_MINUTE }}
              />
            ))}
          </div>
          {stages.map((stage, i) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              bandClass={STAGE_BAND_CLASSES[i % STAGE_BAND_CLASSES.length]}
              rangeStart={rangeStart}
              bodyHeight={bodyHeight}
              performances={performances.filter((p) => p.stageId === stage.id)}
              now={now}
            />
          ))}
        </div>
        {showNow && (
          <div
            aria-hidden="true"
            data-testid="timetable-now"
            className="pointer-events-none absolute inset-x-0 z-10 h-[21px] tabular-nums"
            // 線 (2px) の中心を時刻の位置に合わせる
            style={{
              top: 48 + (nowMinute - rangeStart) * PX_PER_MINUTE - 10.5,
            }}
          >
            <span className="absolute top-0 left-[23px] rounded-full bg-text px-2 py-0.5 text-xs leading-[1.4] text-background">
              {hhmm(nowMinute)}
            </span>
            <span
              className="absolute top-[9.5px] right-0 h-0.5 bg-text"
              style={{ left: TIME_COL_PX }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  bandClass,
  rangeStart,
  bodyHeight,
  performances,
  now,
}: {
  readonly now: Date;
  readonly stage: TimetableStage;
  readonly bandClass: string;
  readonly rangeStart: number;
  readonly bodyHeight: number;
  readonly performances: readonly TimetablePerformance[];
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="relative min-w-0 flex-1 border-l border-gray-200"
    >
      <div className="relative h-12">
        <div className={`absolute inset-x-0 top-0 h-1 ${bandClass}`} />
        <h3
          id={headingId}
          className="px-3 pt-4 text-sm font-bold leading-[1.4] text-text"
        >
          {stage.name}
        </h3>
      </div>
      <ul className="relative" style={{ height: bodyHeight }}>
        {performances.map((p) => (
          <SlotItem
            key={p.id}
            performance={p}
            rangeStart={rangeStart}
            active={isPerformanceActive(p.slot, now)}
          />
        ))}
      </ul>
    </section>
  );
}

function SlotItem({
  performance: p,
  rangeStart,
  active,
}: {
  readonly performance: TimetablePerformance;
  readonly rangeStart: number;
  readonly active: boolean;
}) {
  const start = minuteOfDay(p.slot.startAt);
  const duration = minuteOfDay(p.slot.endAt) - start;
  const compact = duration < COMPACT_UNDER_MINUTES;
  const time = `${formatEventDayTime(p.slot.startAt)}〜${formatEventDayTime(p.slot.endAt)}`;
  const card = `relative block h-full overflow-hidden rounded-sm text-text ${
    active ? 'bg-info p-2' : 'border border-gray-200 bg-gray-100 p-[6px]'
  }`;
  const live = active && (
    <>
      <PlayCircleIcon size={14} className="mr-0.5 shrink-0" />
      <span className="shrink-0 text-xs font-bold">出演中</span>
    </>
  );
  const timeClass = `text-xs ${active ? '' : 'text-gray-600'}`;
  const body = compact ? (
    <span className="flex items-center gap-1 leading-[1.4] tabular-nums">
      {live}
      <span className={`shrink-0 ${timeClass}`}>{time}</span>
      <span className="truncate text-sm font-bold">{p.name}</span>
    </span>
  ) : (
    <>
      <span className="flex items-center gap-1 text-xs leading-[1.4] tabular-nums">
        {live}
        <span className={timeClass}>{time}</span>
      </span>
      <span className="mt-0.5 block text-sm font-bold leading-[1.4]">
        {p.name}
      </span>
    </>
  );
  const current = active ? { 'aria-current': 'true' as const } : {};
  const chevronTop = compact
    ? active
      ? 'top-2'
      : 'top-[5px]'
    : active
      ? 'top-[26.8px]'
      : 'top-[24px]';
  return (
    // 上下左右の余白は li の padding で取り、top/height は時間軸の目盛りそのものにする
    <li
      className="absolute inset-x-0 px-1 py-0.5"
      style={{
        top: (start - rangeStart) * PX_PER_MINUTE,
        height: duration * PX_PER_MINUTE,
      }}
    >
      {p.href ? (
        <Link href={p.href} className={`${card} pr-9`} {...current}>
          {body}
          <ChevronRightIcon
            size={20}
            className={`absolute right-2 ${chevronTop}`}
          />
        </Link>
      ) : (
        <div className={card} {...current}>
          {body}
        </div>
      )}
    </li>
  );
}
