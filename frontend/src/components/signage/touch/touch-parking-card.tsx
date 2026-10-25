import { BADGE, type ParkingBadgeKind } from '@/components/parking-row';
import { formatEventDayTime } from '@/lib/event-day';
import { isStale, type ParkingLot } from '@/lib/parking';

export function TouchParkingCard({
  lot,
  eventDay,
  now,
}: {
  readonly lot: ParkingLot;
  readonly eventDay: boolean;
  readonly now: Date;
}) {
  const kind: ParkingBadgeKind = !eventDay ? 'closed' : (lot.status ?? 'unset');
  const updatedAt = eventDay && lot.status ? lot.updatedAt : null;
  const stale = updatedAt !== null && isStale(updatedAt, now);
  return (
    <li className="flex h-[246px] w-[924px] items-start gap-4 overflow-clip rounded-[16px] border border-gray-200 p-4">
      {/* 駐車場の写真はデータが無いため、写真の場所だけ空けておく */}
      <div className="h-[214px] w-[285px] shrink-0" />
      <div className="flex h-full min-w-px flex-1 flex-col items-start gap-2 overflow-clip">
        <p className="text-signage-heading font-bold text-text">{lot.name}</p>
        <div
          className={`flex items-center justify-center rounded-[8px] px-3 py-1 ${BADGE[kind].style}`}
        >
          <p className="text-signage-label font-bold whitespace-nowrap">
            {BADGE[kind].label}
          </p>
        </div>
        {updatedAt && (
          <div className="flex w-full items-center gap-1">
            {stale && (
              <span
                aria-hidden="true"
                className="material-symbols-sharp text-[24px] leading-6 text-warning"
              >
                history
              </span>
            )}
            <p
              className={`min-w-px flex-1 text-signage-meta ${stale ? 'text-text' : 'text-gray-600'}`}
            >
              {formatEventDayTime(updatedAt)}更新
              {stale && '・情報が古い可能性があります'}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
