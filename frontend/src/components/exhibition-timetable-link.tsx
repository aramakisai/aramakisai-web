'use client';

import { TextLink } from '@/components/text-link';
import {
  pickTimetableTarget,
  type ExhibitionPerformance,
} from '@/lib/timetable';
import { useNow } from '@/lib/use-now';

/**
 * 「今日」は ISR のキャッシュで古くなるため端末の時刻で選ぶ。初回描画は先頭の回の
 * 開始時刻を現在とみなし、サーバー描画と同じ href にする。
 */
export function ExhibitionTimetableLink({
  performances,
}: {
  readonly performances: readonly ExhibitionPerformance[];
}) {
  const now = useNow(performances[0].startAt, 60_000);
  const t = pickTimetableTarget(performances, now) ?? performances[0];
  return (
    <TextLink
      href={`/timetable?day=${t.dateKey}&stage=${t.stageId}&performance=${t.id}`}
      className="self-start"
    >
      タイムテーブルを見る
    </TextLink>
  );
}
