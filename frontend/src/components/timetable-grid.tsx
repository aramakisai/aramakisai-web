import Link from 'next/link';
import { useId } from 'react';
import { ChevronRightIcon, PlayCircleIcon } from './icons';
import { formatEventDayTime, toJstDateKey, toJstParts } from '@/lib/event-day';
import {
  isPerformanceActive,
  stagesWithPerformances,
  type TimetablePerformance,
  type TimetableStage,
} from '@/lib/timetable';
import {
  STAGE_BAND_CLASSES,
  STAGE_TINT_CLASSES,
} from './timetable-stage-colors';
import { TimetableStickyScroller } from './timetable-sticky-scroller';

const PX_PER_MINUTE = 4;
const TIME_COL_PX = 68;
const MIN_COL_PX = 240;
// 端末用: 30 分で 180px、時刻の列 96。ステージ列は残りを等分する
const SIGNAGE_PX_PER_MINUTE = 6;
const SIGNAGE_TIME_COL_PX = 96;
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
  readonly variant?: 'site' | 'signage';
}

export function TimetableGrid({
  stages,
  performances,
  now,
  variant = 'site',
}: TimetableGridProps) {
  const signage = variant === 'signage';
  const visibleStages = stagesWithPerformances(stages, performances);
  const pxPerMinute = signage ? SIGNAGE_PX_PER_MINUTE : PX_PER_MINUTE;
  const timeColPx = signage ? SIGNAGE_TIME_COL_PX : TIME_COL_PX;
  const rangeStart =
    Math.floor(
      Math.min(...performances.map((p) => minuteOfDay(p.slot.startAt))) / 60,
    ) * 60;
  const rangeEnd =
    Math.ceil(
      Math.max(...performances.map((p) => minuteOfDay(p.slot.endAt))) / 60,
    ) * 60;
  // 端末用は見出しが本体の中に入る。サイトでは sticky の見出しの行を本体の外に出す
  const headingOffset = signage ? 48 : 0;
  const baseId = useId();
  const headingIdOf = (stageId: number) => `${baseId}-${stageId}`;
  const bodyHeight = (rangeEnd - rangeStart) * pxPerMinute;
  const ticks: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m += 30) ticks.push(m);

  const nowIso = now.toISOString();
  const nowMinute = minuteOfDay(nowIso);
  const showNow =
    toJstDateKey(nowIso) === performances[0].slot.dateKey &&
    nowMinute >= rangeStart &&
    nowMinute <= rangeEnd;

  const minWidth = TIME_COL_PX + visibleStages.length * MIN_COL_PX;
  const grid = (
    <div className="relative flex" style={signage ? undefined : { minWidth }}>
      <div
        aria-hidden="true"
        className="relative shrink-0 tabular-nums"
        style={{ width: timeColPx }}
      >
        {ticks.map((m) => (
          <span
            key={m}
            className={`absolute left-0 text-right text-gray-600 ${signage ? 'w-[88px] text-signage-meta' : 'w-[60px] text-xs leading-[1.4]'}`}
            style={{ top: headingOffset + (m - rangeStart) * pxPerMinute }}
          >
            {hhmm(m)}
          </span>
        ))}
      </div>
      <div className="relative flex min-w-0 flex-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0"
          style={{ top: headingOffset }}
        >
          {ticks.map((m) => (
            <div
              key={m}
              className={`absolute inset-x-0 border-t border-gray-200 ${m % 60 === 0 ? '' : 'border-dashed'}`}
              // 端末用は最初の線 (見出しとの境) だけ時刻の列まで伸ばす
              style={{
                top: (m - rangeStart) * pxPerMinute,
                ...(signage && m === rangeStart ? { left: -timeColPx } : {}),
              }}
            />
          ))}
        </div>
        {visibleStages.map(({ stage, colorIndex }) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            headingId={headingIdOf(stage.id)}
            bandClass={
              STAGE_BAND_CLASSES[colorIndex % STAGE_BAND_CLASSES.length]
            }
            tintClass={
              STAGE_TINT_CLASSES[colorIndex % STAGE_TINT_CLASSES.length]
            }
            rangeStart={rangeStart}
            bodyHeight={bodyHeight}
            performances={performances.filter((p) => p.stageId === stage.id)}
            now={now}
            signage={signage}
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
            top: headingOffset + (nowMinute - rangeStart) * pxPerMinute - 10.5,
          }}
        >
          <span
            className={`absolute top-0 rounded-full bg-text px-2 py-0.5 text-background ${signage ? 'left-[11.5px] text-signage-label' : 'left-[23px] text-xs leading-[1.4]'}`}
          >
            {hhmm(nowMinute)}
          </span>
          <span
            className="absolute top-[9.5px] right-0 h-0.5 bg-text"
            style={{ left: timeColPx }}
          />
        </div>
      )}
    </div>
  );
  if (signage) return <div data-testid="timetable-grid">{grid}</div>;
  return (
    <TimetableStickyScroller
      minWidth={minWidth}
      heading={
        <>
          <div className="shrink-0" style={{ width: timeColPx }} />
          <div className="flex min-w-0 flex-1">
            {visibleStages.map(({ stage, colorIndex }) => (
              <div
                key={stage.id}
                className="min-w-0 flex-1 border-l border-gray-200"
              >
                <StageHeading
                  id={headingIdOf(stage.id)}
                  name={stage.name}
                  bandClass={
                    STAGE_BAND_CLASSES[colorIndex % STAGE_BAND_CLASSES.length]
                  }
                  signage={false}
                />
              </div>
            ))}
          </div>
        </>
      }
    >
      {grid}
    </TimetableStickyScroller>
  );
}

function StageHeading({
  id,
  name,
  bandClass,
  signage,
}: {
  readonly id: string;
  readonly name: string;
  readonly bandClass: string;
  readonly signage: boolean;
}) {
  return (
    <div className="relative h-12">
      <div className={`absolute inset-x-0 top-0 h-1 ${bandClass}`} />
      <h3
        id={id}
        className={`px-3 pt-4 font-bold text-text ${signage ? 'text-signage-heading leading-[35px]' : 'text-sm leading-[1.4]'}`}
      >
        {name}
      </h3>
    </div>
  );
}

function StageColumn({
  stage,
  headingId,
  bandClass,
  tintClass,
  rangeStart,
  bodyHeight,
  performances,
  now,
  signage,
}: {
  readonly signage: boolean;
  readonly now: Date;
  readonly stage: TimetableStage;
  readonly headingId: string;
  readonly bandClass: string;
  readonly tintClass: string;
  readonly rangeStart: number;
  readonly bodyHeight: number;
  readonly performances: readonly TimetablePerformance[];
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="relative min-w-0 flex-1 border-l border-gray-200"
    >
      {signage && (
        <StageHeading
          id={headingId}
          name={stage.name}
          bandClass={bandClass}
          signage
        />
      )}
      <ul className="relative" style={{ height: bodyHeight }}>
        {performances.map((p) => (
          <SlotItem
            key={p.id}
            performance={p}
            rangeStart={rangeStart}
            tintClass={tintClass}
            active={isPerformanceActive(p.slot, now)}
            signage={signage}
          />
        ))}
      </ul>
    </section>
  );
}

function SlotItem({
  performance: p,
  rangeStart,
  tintClass,
  active,
  signage,
}: {
  readonly tintClass: string;
  readonly signage: boolean;
  readonly performance: TimetablePerformance;
  readonly rangeStart: number;
  readonly active: boolean;
}) {
  const pxPerMinute = signage ? SIGNAGE_PX_PER_MINUTE : PX_PER_MINUTE;
  const start = minuteOfDay(p.slot.startAt);
  const duration = minuteOfDay(p.slot.endAt) - start;
  const compact = duration < COMPACT_UNDER_MINUTES;
  const time = `${formatEventDayTime(p.slot.startAt)}〜${formatEventDayTime(p.slot.endAt)}`;
  // 端末用は余白を Figma の実測 (非出演は枠 1 + 7、出演中は 8) に合わせ、行間を持たせない
  const pad = signage
    ? active
      ? `px-2 ${compact ? 'py-[10px]' : 'pt-3'}`
      : `px-[7px] ${compact ? 'py-[9px]' : 'pt-[11px]'}`
    : active
      ? 'p-2'
      : 'p-[6px]';
  const card = `relative block h-full overflow-hidden rounded-sm text-text ${
    active
      ? 'bg-info'
      : `border border-gray-200 ${signage ? 'bg-gray-100' : tintClass}`
  } ${pad}`;
  const live = active && (
    <>
      <PlayCircleIcon
        size={signage ? 24 : 14}
        className={`shrink-0 ${signage ? '' : 'mr-0.5'}`}
      />
      <span
        className={`shrink-0 font-bold ${signage ? 'text-signage-label' : 'text-xs'}`}
      >
        出演中
      </span>
    </>
  );
  const timeClass = signage
    ? 'text-signage-meta text-gray-600'
    : `text-xs ${active ? '' : 'text-gray-600'}`;
  const body = compact ? (
    <span
      className={`flex items-center tabular-nums ${signage ? (active ? 'gap-2' : 'gap-1') : 'gap-1 leading-[1.4]'}`}
    >
      {live}
      <span className={`shrink-0 ${timeClass}`}>{time}</span>
      <span
        className={`truncate font-bold ${signage ? 'text-signage-heading' : 'text-sm'}`}
      >
        {signage ? p.name : (p.projectName ?? p.name)}
      </span>
    </span>
  ) : (
    <>
      <span
        className={`flex items-center tabular-nums ${signage ? (active ? 'gap-2' : 'gap-1') : 'gap-1 text-xs leading-[1.4]'}`}
      >
        {live}
        <span className={timeClass}>{time}</span>
      </span>
      <span
        className={`block font-bold ${signage ? 'text-signage-heading' : 'mt-0.5 text-sm leading-[1.4]'}`}
      >
        {signage ? p.name : (p.projectName ?? p.name)}
      </span>
      {!signage && p.projectName && (
        <span
          className={`mt-0.5 block text-xs leading-[1.4] ${active ? '' : 'text-gray-600'}`}
        >
          {p.name}
        </span>
      )}
    </>
  );
  const current = active ? { 'aria-current': 'true' as const } : {};
  const chevronTop = signage
    ? compact
      ? active
        ? 'top-[14px] right-2'
        : 'top-[13px] right-[7px]'
      : active
        ? 'top-[45px] right-2'
        : 'top-[44px] right-[7px]'
    : compact
      ? active
        ? 'top-2'
        : 'top-[5px]'
      : active
        ? 'top-[26.8px]'
        : 'top-[24px]';
  return (
    // 上下左右の余白は li の padding で取り、top/height は時間軸の目盛りそのものにする
    <li
      className={`absolute inset-x-0 py-0.5 ${signage ? 'pr-[6px] pl-[5px]' : 'px-1'}`}
      style={{
        top: (start - rangeStart) * pxPerMinute,
        height: duration * pxPerMinute,
      }}
    >
      {p.href ? (
        <Link
          href={p.href}
          className={`${card} ${signage ? (active ? 'pr-11' : 'pr-[43px]') : 'pr-9'} hover-card-shadow hover:z-10`}
          {...current}
        >
          {body}
          <ChevronRightIcon
            size={signage ? 28 : 20}
            className={`absolute ${signage ? '' : 'right-2'} ${chevronTop}`}
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
