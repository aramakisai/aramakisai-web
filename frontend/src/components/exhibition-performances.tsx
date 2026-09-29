import Link from 'next/link';
import { formatEventDayTime } from '@/lib/event-day';
import type { ExhibitionPerformance } from '@/lib/timetable';

export function ExhibitionPerformances({
  performances,
}: {
  readonly performances: readonly ExhibitionPerformance[];
}) {
  if (performances.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-6 lg:pt-8">
      <h2 className="py-0 text-[20px] leading-[140%] text-text lg:text-[24px] lg:leading-[130%]">
        出演時間
      </h2>
      <ul className="flex flex-col gap-1 text-base leading-[180%] text-text tabular-nums">
        {performances.map((p) => (
          <li key={`${p.startAt}-${p.stageName}`}>
            {p.dayLabel} {formatEventDayTime(p.startAt)}〜
            {formatEventDayTime(p.endAt)} {p.stageName}
          </li>
        ))}
      </ul>
      <Link href="/timetable" className="text-sm font-medium underline">
        タイムテーブルを見る
      </Link>
    </div>
  );
}
