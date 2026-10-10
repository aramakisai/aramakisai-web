import { STAGE_BAND_CLASSES } from '@/components/timetable-stage-colors';
import { formatEventDayTime, toJstDateKey, toJstParts } from '@/lib/event-day';
import { timetableWindow } from '@/lib/signage';
import {
  isPerformanceActive,
  resolveInitialDayKey,
  type Timetable,
  type TimetablePerformance,
} from '@/lib/timetable';
import { SignageHeadingChip } from '../signage-heading-chip';

const PX_PER_MINUTE = 2.8;
const HEADER_H = 56;
const TIME_COL = 90;
const BODY_H = 240 * PX_PER_MINUTE;
// 2.8px/分では30分の枠でも名前を2行目に置ける高さになるが、それより短いと入らない
const COMPACT_UNDER_MINUTES = 27;

function minuteOfDay(iso: string): number {
  const { hours, minutes } = toJstParts(iso);
  return hours * 60 + minutes;
}

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function TimetableSlide({
  timetable,
  now,
}: {
  readonly timetable: Timetable;
  readonly now: Date;
}) {
  const dayKey = resolveInitialDayKey(timetable.days, now);
  const performances = timetable.performances.filter(
    (p) => p.slot.dateKey === dayKey,
  );
  const { startMinute, endMinute } = timetableWindow(performances, now);
  const ticks: number[] = [];
  for (let m = startMinute; m <= endMinute; m += 30) ticks.push(m);
  const nowMinute = minuteOfDay(now.toISOString());
  const showNow =
    dayKey === toJstDateKey(now.toISOString()) &&
    nowMinute >= startMinute &&
    nowMinute <= endMinute;
  const y = (m: number) => HEADER_H + (m - startMinute) * PX_PER_MINUTE;

  return (
    <div className="relative h-[864px] w-[1536px] overflow-hidden rounded-[16px] bg-background">
      <SignageHeadingChip icon="calendar_clock" label="タイムテーブル" />
      <div className="absolute top-[92px] left-6 h-[728px] w-[1488px]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 h-px bg-gray-200"
          style={{ top: HEADER_H }}
        />
        {ticks.slice(1).map((m) => (
          <div
            key={m}
            aria-hidden="true"
            className={`absolute right-0 border-t border-gray-200 ${m % 60 === 0 ? '' : 'border-dashed'}`}
            style={{ left: TIME_COL, top: y(m) }}
          />
        ))}
        {ticks.map((m) => (
          <p
            key={m}
            aria-hidden="true"
            className="absolute w-[82px] text-right font-display text-[24px] leading-[1.2] text-gray-600 tabular-nums"
            style={{ left: 0, top: y(m) - 14 }}
          >
            {hhmm(m)}
          </p>
        ))}
        <div
          className="absolute flex"
          style={{ left: TIME_COL, top: 0, right: 0, height: '100%' }}
        >
          {timetable.stages.map((stage, i) => (
            <section
              key={stage.id}
              className="relative min-w-0 flex-1 border-l border-gray-200"
            >
              <div className="relative" style={{ height: HEADER_H }}>
                <div
                  className={`absolute inset-x-0 top-0 h-1 ${STAGE_BAND_CLASSES[i % STAGE_BAND_CLASSES.length]}`}
                />
                <h3 className="px-3 pt-4 font-display text-[28px] leading-[1.2] font-bold text-text">
                  {stage.name}
                </h3>
              </div>
              <ul
                className="relative overflow-hidden"
                style={{ height: BODY_H }}
              >
                {performances
                  .filter((p) => p.stageId === stage.id)
                  .map((p) => (
                    <Slot
                      key={p.id}
                      performance={p}
                      startMinute={startMinute}
                      active={isPerformanceActive(p.slot, now)}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
        {showNow && (
          <div
            aria-hidden="true"
            data-testid="timetable-now"
            className="absolute right-0 h-0.5 bg-text"
            style={{ left: 68, top: y(nowMinute) - 1 }}
          />
        )}
      </div>
    </div>
  );
}

function Slot({
  performance: p,
  startMinute,
  active,
}: {
  readonly performance: TimetablePerformance;
  readonly startMinute: number;
  readonly active: boolean;
}) {
  const start = minuteOfDay(p.slot.startAt);
  const duration = minuteOfDay(p.slot.endAt) - start;
  const compact = duration < COMPACT_UNDER_MINUTES;
  const time = `${formatEventDayTime(p.slot.startAt)}〜${formatEventDayTime(p.slot.endAt)}`;
  const timeRow = (
    <span className="flex items-center leading-[1.2] tabular-nums">
      {active && (
        <>
          <span
            aria-hidden="true"
            className="material-symbols-sharp mt-px self-start leading-4 font-light"
            style={{ fontSize: 16 }}
          >
            play_circle
          </span>
          <span className="font-display text-[24px] font-bold">出演中</span>
          <span className="w-4" />
        </>
      )}
      <span
        className={`font-display text-[24px] ${active ? '' : 'text-gray-600'}`}
      >
        {time}
      </span>
    </span>
  );
  const name = (
    <span
      className={`font-display text-[28px] font-bold ${compact ? 'truncate leading-[1.2]' : '-mt-2.5 block leading-[1.6]'}`}
    >
      {p.name}
    </span>
  );
  return (
    // 上下4px・左右8pxの余白は li の padding で取り、top/height は時間軸の目盛りそのものにする。
    // 左端を列の区切り線(border-l)に重ねて、枠の位置を区切り線から4pxにする
    <li
      className="absolute -left-px right-0 px-1 py-0.5"
      style={{
        top: (start - startMinute) * PX_PER_MINUTE,
        height: duration * PX_PER_MINUTE,
      }}
    >
      <div
        aria-current={active ? 'true' : undefined}
        className={`h-full overflow-hidden rounded-[4px] text-text ${
          active ? 'bg-info p-2' : 'border border-gray-200 bg-gray-100 p-[6px]'
        } ${compact ? 'flex items-center gap-3' : ''}`}
      >
        {timeRow}
        {name}
      </div>
    </li>
  );
}
