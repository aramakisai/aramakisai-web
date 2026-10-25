import Link from 'next/link';
import { ScheduleIcon } from '@/components/icons';
import { TextLink } from '@/components/text-link';
import { formatEventDayTime } from '@/lib/event-day';
import type { ExhibitionPerformance } from '@/lib/timetable';

export function ExhibitionPerformances({
  performances,
  variant = 'site',
}: {
  readonly performances: readonly ExhibitionPerformance[];
  readonly variant?: 'site' | 'signage';
}) {
  if (performances.length === 0) return null;
  const signage = variant === 'signage';
  return (
    <div
      className={`flex items-start gap-1 font-medium text-gray-600 ${signage ? 'text-signage-meta' : 'text-sm leading-[140%]'}`}
    >
      <ScheduleIcon size={signage ? 24 : 20} className="shrink-0 text-text" />
      <div className="flex flex-col gap-1 tabular-nums">
        {performances.map((p) => (
          <p key={`${p.startAt}-${p.stageName}`}>
            {p.dayLabel} {formatEventDayTime(p.startAt)}〜
            {formatEventDayTime(p.endAt)} {p.stageName}
          </p>
        ))}
        {signage ? (
          <Link href="/timetable" className="self-start underline">
            タイムテーブルを見る
          </Link>
        ) : (
          <TextLink href="/timetable" className="self-start">
            タイムテーブルを見る
          </TextLink>
        )}
      </div>
    </div>
  );
}
