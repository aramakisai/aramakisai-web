import { formatEventDayTime } from '@/lib/event-day';
import { isStale, type ParkingLot, type ParkingStatus } from '@/lib/parking';

export type ParkingBadgeKind = ParkingStatus | 'unset' | 'closed';

export const BADGE: Record<ParkingBadgeKind, { label: string; style: string }> =
  {
    available: { label: '空き', style: 'bg-success text-text' },
    crowded: { label: '混雑', style: 'bg-primary text-text' },
    full: { label: '満車', style: 'bg-warning text-text' },
    unset: { label: '未設定', style: 'bg-gray-200 text-gray-600' },
    closed: { label: '非公開', style: 'bg-gray-200 text-gray-600' },
  };

export function ParkingStatusBadge({
  kind,
}: {
  readonly kind: ParkingBadgeKind;
}) {
  const { label, style } = BADGE[kind];
  return (
    <div
      className={`flex h-8 w-16 shrink-0 items-center justify-center rounded-sm text-sm leading-[1.4] font-bold ${style}`}
    >
      {label}
    </div>
  );
}

export function ParkingRow({
  lot,
  eventDay,
  now,
}: {
  readonly lot: ParkingLot;
  readonly eventDay: boolean;
  readonly now: Date;
}) {
  const updatedAt = eventDay && lot.status ? lot.updatedAt : null;
  const kind: ParkingBadgeKind = !eventDay ? 'closed' : (lot.status ?? 'unset');
  return (
    <li className="flex items-center gap-4 border-b border-gray-200 p-4">
      <ParkingStatusBadge kind={kind} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base leading-[1.6] font-bold text-text">
          {lot.name}
        </p>
        {updatedAt && <UpdatedAt updatedAt={updatedAt} now={now} />}
      </div>
    </li>
  );
}

function UpdatedAt({
  updatedAt,
  now,
}: {
  readonly updatedAt: string;
  readonly now: Date;
}) {
  const time = `${formatEventDayTime(updatedAt)}更新`;
  return isStale(updatedAt, now) ? (
    <p className="flex items-center gap-1 text-xs leading-[1.4] text-text tabular-nums">
      <span
        aria-hidden="true"
        className="material-symbols-sharp text-base leading-4 text-warning"
      >
        history
      </span>
      <span className="min-w-0 flex-1">{time}・情報が古い可能性があります</span>
    </p>
  ) : (
    <p className="text-xs leading-[1.4] text-gray-600 tabular-nums">{time}</p>
  );
}
