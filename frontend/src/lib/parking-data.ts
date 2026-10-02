import { cms, type CmsResult } from './cms';
import { getParkingEnabled } from './festival-meta';
import { DEV_OVERRIDE_ENABLED } from './phase';
import type { ParkingResponse } from './parking';

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

  const lots = await cms.findMany(
    'parking_lots',
    { sort: ['sort'], limit: PARKING_LIMIT },
    { ttlSeconds: PARKING_TTL_SECONDS },
  );
  if (!lots.ok) return lots;
  return {
    ok: true,
    value: {
      enabled: true,
      lots: lots.value.docs,
      fetchedAt: new Date().toISOString(),
    },
  };
}
