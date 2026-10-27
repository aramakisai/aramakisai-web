import { cms, type CmsResult } from './cms';
import { isEventDay, toEventDays, toJstParts } from './event-day';
import { env } from '@/env';
import type { ParkingImage, ParkingLot, ParkingResponse } from './parking';
import { compareOrderKey } from './order-key';
import { getRequestPhase } from './request-phase';

const PARKING_TTL_SECONDS = 20;
// limit を省くと Payload 既定の 10 件で切れる
const PARKING_LIMIT = 100;

const DEFAULT_MONITOR = { start: '09:00', end: '17:30' };

// cms/src/lib/parking-monitor.ts と同じ規則 (日本時間、両端を含む、HH:mm の分単位比較)
function isWithinMonitorWindow(
  now: Date,
  monitor: { start?: string | null; end?: string | null } | undefined,
): boolean {
  const start = monitor?.start ?? DEFAULT_MONITOR.start;
  const end = monitor?.end ?? DEFAULT_MONITOR.end;
  const { hours, minutes } = toJstParts(now.toISOString());
  const t = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return start <= t && t <= end;
}

const toAbsolute = (url: string) =>
  url.startsWith('/') ? `${env.NEXT_PUBLIC_CMS_URL}${url}` : url;

// 取得失敗は画像だけ値なしにして状態は返す
async function fetchLatestImages(
  version: number | undefined,
): Promise<Map<number, ParkingImage>> {
  const snapshots = await cms.findMany(
    'parking_snapshots',
    {
      where: { lot: { exists: true } },
      sort: ['-createdAt'],
      depth: 0,
      limit: PARKING_LIMIT,
      select: {
        lot: true,
        sizes: true,
        captured_at: true,
        url: true,
        width: true,
        height: true,
      },
    },
    { ttlSeconds: PARKING_TTL_SECONDS, version },
  );
  const images = new Map<number, ParkingImage>();
  if (!snapshots.ok) return images;
  for (const doc of snapshots.value.docs) {
    const lotId = typeof doc.lot === 'object' ? doc.lot?.id : doc.lot;
    if (lotId == null || images.has(lotId)) continue;
    const web = doc.sizes?.web;
    const src = web?.url ? web : doc;
    if (!src.url || !src.width || !src.height) continue;
    images.set(lotId, {
      url: toAbsolute(src.url),
      capturedAt: doc.captured_at,
      width: src.width,
      height: src.height,
    });
  }
  return images;
}

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

  const now = new Date();
  const images =
    eventDay && isWithinMonitorWindow(now, meta.value.parking_monitor)
      ? await fetchLatestImages(version)
      : new Map<number, ParkingImage>();

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
    image: images.get(lot.id) ?? null,
  }));
  return {
    ok: true,
    value: { isEventDay: eventDay, lots, fetchedAt: new Date().toISOString() },
  };
}
