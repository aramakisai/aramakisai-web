'use client';

import { SectionHeading } from '@/components/section-heading';
import { ParkingRow } from '@/components/parking-row';
import { formatEventDayTime } from '@/lib/event-day';
import type { ParkingResponse } from '@/lib/parking';
import { usePolling } from '@/lib/use-polling';
import { useNow } from '@/lib/use-now';

const INTERVAL_MS = 20_000;

async function fetchParking(): Promise<ParkingResponse> {
  const res = await fetch('/api/parking', { cache: 'no-store' });
  if (!res.ok) throw new Error(`parking ${res.status}`);
  return res.json();
}

const continuePolling = (r: ParkingResponse) => r.enabled;

export interface ParkingListProps {
  readonly initial: ParkingResponse | null;
  readonly renderedAt: string;
}

export function ParkingList({ initial, renderedAt }: ParkingListProps) {
  const now = useNow(renderedAt);
  const { data, error } = usePolling<ParkingResponse>({
    fetcher: fetchParking,
    intervalMs: INTERVAL_MS,
    initial,
    shouldContinue: continuePolling,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <SectionHeading level="h1" className="mb-0! text-center">
          駐車場空き情報
        </SectionHeading>
        <div className="lg:pl-4">{statusLine(data, error)}</div>
      </div>
      {data?.enabled &&
        (data.lots.length === 0 ? (
          <p className="p-4 text-sm leading-[1.4] text-gray-600">
            駐車場の情報はありません
          </p>
        ) : (
          // SP はページの px-4 を打ち消し、行の罫線を画面幅いっぱいにする
          <ul className="-mx-4 lg:mx-0">
            {data.lots.map((lot) => (
              <ParkingRow key={lot.id} lot={lot} now={now} />
            ))}
          </ul>
        ))}
    </div>
  );
}

function statusLine(data: ParkingResponse | null, error: boolean) {
  if (data && !data.enabled) {
    return (
      <p className="text-sm leading-[1.4] text-gray-600">
        現在、駐車場空き情報は公開していません
      </p>
    );
  }
  if (!data || error) {
    const text = data
      ? `最新の情報を取得できません(${formatEventDayTime(data.fetchedAt)}時点)`
      : '最新の情報を取得できません';
    return (
      <p className="flex items-center gap-1 text-sm leading-[1.4] text-text">
        <span
          aria-hidden="true"
          className="material-symbols-sharp text-base leading-4 text-warning"
        >
          sync_problem
        </span>
        {text}
      </p>
    );
  }
  return (
    <p className="text-sm leading-[1.4] text-gray-600 tabular-nums">
      {formatEventDayTime(data.fetchedAt)}時点
    </p>
  );
}
