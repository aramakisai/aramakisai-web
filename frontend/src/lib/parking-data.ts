import { cms, type CmsResult } from './cms';
import { isEventDay, toEventDays } from './event-day';
import type { ParkingLot, ParkingResponse } from './parking';
import { compareOrderKey } from './order-key';
import { getRequestPhase } from './request-phase';

const PARKING_TTL_SECONDS = 20;
// limit を省くと Payload 既定の 10 件で切れる
const PARKING_LIMIT = 100;

export async function getParkingResponse({
  version,
}: { readonly version?: number } = {}): Promise<CmsResult<ParkingResponse>> {
  // 上書きで当日扱いにする場合も site_settings の失敗は握りつぶさず失敗として返す
  const meta = await cms.findGlobal('site_settings', {}, { version });
  if (!meta.ok) return meta;
  const phase = await getRequestPhase();
  const eventDay =
    (phase.source === 'override' && phase.phase === 'live') ||
    isEventDay(toEventDays(meta.value.event_days));

  const statuses = await cms.findMany(
    'parking_statuses',
    { depth: 1, limit: PARKING_LIMIT },
    { ttlSeconds: PARKING_TTL_SECONDS, version },
  );
  if (!statuses.ok) return statuses;

  const rows = statuses.value.docs.flatMap((doc) =>
    typeof doc.lot === 'object' && doc.lot !== null
      ? [{ doc, lot: doc.lot }]
      : [],
  );
  // _order は関連先のフィールドなので REST の sort では並べられない。
  // localeCompare は使わず大小比較にして Postgres の並びと一致させる
  rows.sort((a, b) => compareOrderKey(a.lot._order, b.lot._order));
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
