import { cms, type CmsResult } from './cms';
import { isEventDay, toEventDays } from './event-day';
import type { ParkingLot, ParkingResponse } from './parking';
import { getRequestPhase } from './request-phase';

const PARKING_TTL_SECONDS = 20;
// limit を省くと Payload 既定の 10 件で切れる
const PARKING_LIMIT = 100;

export async function getParkingResponse(): Promise<
  CmsResult<ParkingResponse>
> {
  // 上書きで当日扱いにする場合も festival_meta の失敗は握りつぶさず失敗として返す
  const meta = await cms.findGlobal('festival_meta');
  if (!meta.ok) return meta;
  const phase = await getRequestPhase();
  const eventDay =
    (phase.source === 'override' && phase.phase === 'live') ||
    isEventDay(toEventDays(meta.value.event_days));

  const statuses = await cms.findMany(
    'parking_statuses',
    { depth: 1, limit: PARKING_LIMIT },
    { ttlSeconds: PARKING_TTL_SECONDS },
  );
  if (!statuses.ok) return statuses;

  const rows = statuses.value.docs.flatMap((doc) =>
    typeof doc.lot === 'object' && doc.lot !== null
      ? [{ doc, lot: doc.lot }]
      : [],
  );
  // sort は関連先のフィールドなので REST の sort では並べられない
  rows.sort(
    (a, b) =>
      (a.lot.sort ?? Number.POSITIVE_INFINITY) -
        (b.lot.sort ?? Number.POSITIVE_INFINITY) || 0,
  );
  // 当日以外は古いテストデータ等を外へ出さないため、サーバー側で落とす
  const lots: ParkingLot[] = rows.map(({ doc, lot }) => ({
    id: doc.id,
    name: lot.name,
    status: eventDay ? (doc.status ?? null) : null,
    updatedAt: eventDay && doc.status ? doc.updatedAt : null,
  }));
  return {
    ok: true,
    value: { isEventDay: eventDay, lots, fetchedAt: new Date().toISOString() },
  };
}
