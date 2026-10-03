import { cms, type CmsResult } from './cms';
import { getParkingEnabled } from './festival-meta';
import { DEV_OVERRIDE_ENABLED } from './phase';
import type { ParkingLot, ParkingResponse } from './parking';

const PARKING_TTL_SECONDS = 20;
// limit を省くと Payload 既定の 10 件で切れる
const PARKING_LIMIT = 100;

export async function getParkingResponse(): Promise<
  CmsResult<ParkingResponse>
> {
  // 上書き有効時も festival_meta の失敗は握りつぶさず失敗として返す
  const enabled = await getParkingEnabled();
  if (!enabled.ok) return enabled;
  if (!DEV_OVERRIDE_ENABLED && !enabled.value) {
    return { ok: true, value: { enabled: false } };
  }

  const statuses = await cms.findMany(
    'parking_statuses',
    { depth: 1, limit: PARKING_LIMIT },
    { ttlSeconds: PARKING_TTL_SECONDS },
  );
  if (!statuses.ok) return statuses;

  const rows = statuses.value.docs.flatMap((doc) =>
    typeof doc.lot === 'object' && doc.lot !== null ? [{ doc, lot: doc.lot }] : [],
  );
  // sort は関連先のフィールドなので REST の sort では並べられない
  rows.sort(
    (a, b) =>
      (a.lot.sort ?? Number.POSITIVE_INFINITY) -
        (b.lot.sort ?? Number.POSITIVE_INFINITY) || 0,
  );
  const lots: ParkingLot[] = rows.map(({ doc, lot }) => ({
    id: doc.id,
    name: lot.name,
    status: doc.status,
    updatedAt: doc.updatedAt,
  }));
  return {
    ok: true,
    value: { enabled: true, lots, fetchedAt: new Date().toISOString() },
  };
}
