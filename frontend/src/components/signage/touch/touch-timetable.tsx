'use client';

import { useEffect, useRef, useState } from 'react';
import { TimetableGrid } from '@/components/timetable-grid';
import { useNow } from '@/lib/use-now';
import { useTouchClockShift } from '@/lib/use-touch-clock-shift';
import { resolveInitialDayKey, type Timetable } from '@/lib/timetable';
import { TouchSegment } from './touch-segment';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// key は JST の暦日 'YYYY-MM-DD'。UTC 0 時として読めば環境のタイムゾーンに依らず同じ日付・曜日になる
function dayButtonLabel(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${WEEKDAYS[d.getUTCDay()]}`;
}

export function TouchTimetable({
  timetable,
  initialDayKey,
  renderedAt,
}: {
  readonly timetable: Timetable;
  readonly initialDayKey: string | null;
  readonly renderedAt: string;
}) {
  const shift = useTouchClockShift();
  const real = useNow(renderedAt);
  const now = new Date(real.getTime() + (shift ?? 0));
  const { days, stages, performances } = timetable;
  const [dayKey, setDayKey] = useState(initialDayKey);
  const userPicked = useRef(false);
  const shiftApplied = useRef(false);
  // 試験日の決め直しは最初の非 null のずれ量だけ。以後の試験開始し直しで利用者の閲覧中の日を動かさない
  useEffect(() => {
    if (shift === null || shiftApplied.current) return;
    shiftApplied.current = true;
    if (!userPicked.current) {
      setDayKey(resolveInitialDayKey(days, new Date(Date.now() + shift)));
    }
  }, [shift, days]);
  const dayPerformances = performances.filter((p) => p.slot.dateKey === dayKey);

  return (
    <>
      {/* 最後の行を操作の楕円より上へ送れるよう、下端に 240 の余白を置く */}
      <div className="min-h-dvh px-6 pt-6 pb-[240px]">
        {dayPerformances.length > 0 ? (
          <TimetableGrid
            stages={stages}
            performances={dayPerformances}
            now={now}
            variant="signage"
          />
        ) : (
          <p className="text-signage-body">出演予定はありません</p>
        )}
      </div>
      {days.length > 0 && (
        // 上位文書では y864〜936。iframe は上端 352 から始まるので 512
        <div className="fixed top-[512px] right-6">
          <TouchSegment
            size="page"
            items={days.map((d) => ({
              value: d.key,
              label: dayButtonLabel(d.key),
              color: 'bg-info',
            }))}
            value={dayKey}
            onSelect={(key) => {
              userPicked.current = true;
              setDayKey(key);
            }}
          />
        </div>
      )}
    </>
  );
}
