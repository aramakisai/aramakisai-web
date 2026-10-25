'use client';

import { formatEventDayTime } from '@/lib/event-day';
import type { ParkingResponse } from '@/lib/parking';
import { usePolling } from '@/lib/use-polling';
import { useNow } from '@/lib/use-now';
import { TouchParkingCard } from './touch-parking-card';

const INTERVAL_MS = 20_000;

async function fetchParking(): Promise<ParkingResponse> {
  const res = await fetch('/api/parking', { cache: 'no-store' });
  if (!res.ok) throw new Error(`parking ${res.status}`);
  return res.json();
}

export function TouchParkingList({
  initial,
  renderedAt,
}: {
  readonly initial: ParkingResponse | null;
  readonly renderedAt: string;
}) {
  const now = useNow(renderedAt);
  const { data } = usePolling<ParkingResponse>({
    fetcher: fetchParking,
    intervalMs: INTERVAL_MS,
    initial,
    shouldContinue: (r) => r.isEventDay,
  });

  if (!data) {
    return (
      <p className="px-6 pt-2 text-signage-meta text-gray-600">
        駐車場の情報を取得できません
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-6 pt-2">
      <p className="text-signage-meta text-gray-600">
        {formatEventDayTime(data.fetchedAt)}時点
      </p>
      <ul className="grid grid-cols-[924px_924px] gap-6">
        {data.lots.map((lot) => (
          <TouchParkingCard
            key={lot.id}
            lot={lot}
            eventDay={data.isEventDay}
            now={now}
          />
        ))}
      </ul>
    </div>
  );
}
