'use client';

import { useState } from 'react';
import { TimetableGrid } from '@/components/timetable-grid';
import { useNow } from '@/lib/use-now';
import type { Timetable } from '@/lib/timetable';
import { TouchSegment } from './touch-segment';

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
              label: d.label,
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
