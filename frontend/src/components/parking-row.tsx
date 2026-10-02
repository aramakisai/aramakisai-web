import { formatEventDayTime } from '@/lib/event-day';
import { isStale, type ParkingLot, type ParkingStatus } from '@/lib/parking';

const BADGE: Record<ParkingStatus, { label: string; bg: string }> = {
  available: { label: '空き', bg: 'bg-success' },
  crowded: { label: '混雑', bg: 'bg-primary' },
  full: { label: '満車', bg: 'bg-warning' },
};

export function ParkingStatusBadge({
  status,
}: {
  readonly status: ParkingStatus;
}) {
  const { label, bg } = BADGE[status];
  return (
    <div
      className={`flex h-8 w-16 shrink-0 items-center justify-center rounded-sm text-sm leading-[1.4] font-bold text-text ${bg}`}
    >
      {label}
    </div>
  );
}

export function ParkingRow({
  lot,
  now,
}: {
  readonly lot: ParkingLot;
  readonly now: Date;
}) {
  const time = `${formatEventDayTime(lot.updatedAt)}更新`;
  return (
    <li className="flex items-center gap-4 border-b border-gray-200 p-4">
      <ParkingStatusBadge status={lot.status} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base leading-[1.6] font-bold text-text">
          {lot.name}
        </p>
        {isStale(lot, now) ? (
          <p className="flex items-center gap-1 text-xs leading-[1.4] text-text tabular-nums">
            <span
              aria-hidden="true"
              className="material-symbols-sharp text-base leading-4 text-warning"
            >
              history
            </span>
            <span className="min-w-0 flex-1">
              {time}・情報が古い可能性があります
            </span>
          </p>
        ) : (
          <p className="text-xs leading-[1.4] text-gray-600 tabular-nums">
            {time}
          </p>
        )}
      </div>
    </li>
  );
}
