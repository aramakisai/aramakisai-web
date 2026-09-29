import Link from 'next/link';
import { ScheduleIcon } from '@/components/icons';
import { formatEventDayTime } from '@/lib/event-day';
import type { ExhibitionPerformance } from '@/lib/timetable';

export function ExhibitionPerformances({
  performances,
}: {
  readonly performances: readonly ExhibitionPerformance[];
}) {
  if (performances.length === 0) return null;
  return (
    <div className="flex items-start gap-1 text-sm leading-[140%] font-medium text-gray-600">
      <ScheduleIcon size={20} className="shrink-0 text-text" />
      <div className="flex flex-col gap-1 tabular-nums">
        {performances.map((p) => (
          <p key={`${p.startAt}-${p.stageName}`}>
            {p.dayLabel} {formatEventDayTime(p.startAt)}〜
            {formatEventDayTime(p.endAt)} {p.stageName}
          </p>
        ))}
        <Link href="/timetable" className="underline">
          タイムテーブルを見る
        </Link>
      </div>
    </div>
  );
}
