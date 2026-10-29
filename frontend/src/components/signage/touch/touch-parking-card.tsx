import { BADGE, type ParkingBadgeKind } from '@/components/parking-row';
import { formatEventDayTime } from '@/lib/event-day';
import { isImageStale, isStale, type ParkingLot } from '@/lib/parking';

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
  const image = updatedAt ? lot.image : null;
  return (
    <li className="flex h-[246px] w-[924px] items-start gap-4 overflow-clip rounded-[16px] border border-gray-200 p-4">
      <div className="h-[214px] w-[285px] shrink-0">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- CMS 配信の縮小版をそのまま使う
          <img
            src={image.url}
            alt={`${lot.name}の現在の様子`}
            className="size-full rounded-[8px] object-cover"
          />
        )}
      </div>
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
          <TimeLine
            time={`${formatEventDayTime(updatedAt)}更新`}
            staleNote="情報が古い可能性があります"
            stale={isStale(updatedAt, now)}
          />
        )}
        {image && (
          <TimeLine
            time={`${formatEventDayTime(image.capturedAt)}撮影`}
            staleNote="古い画像の可能性があります"
            stale={isImageStale(image.capturedAt, now)}
          />
        )}
      </div>
    </li>
  );
}

function TimeLine({
  time,
  staleNote,
  stale,
}: {
  readonly time: string;
  readonly staleNote: string;
  readonly stale: boolean;
}) {
  return (
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
        {time}
        {stale && `・${staleNote}`}
      </p>
    </div>
  );
}
