'use client';

import { useState } from 'react';
import { TimetableGrid } from '@/components/timetable-grid';
import { useNow } from '@/lib/use-now';
import type { Timetable } from '@/lib/timetable';
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
  const now = useNow(renderedAt);
  const { days, stages, performances } = timetable;
  const [dayKey, setDayKey] = useState(initialDayKey);
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
            onSelect={setDayKey}
          />
        </div>
      )}
    </>
  );
}
