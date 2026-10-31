import {
  decodeTripUpdates,
  decodeVehicles,
  type RealtimeFeed,
  type RealtimeTripUpdate,
  type RealtimeVehicle,
} from './gtfs-realtime';
import { usePolling } from './use-polling';

// ODPT の利用ガイドラインに合わせた取得間隔。引数で短縮できないよう定数に固定する
const BUS_REALTIME_INTERVAL_MS = 30_000;

const FEED_BASE =
  'https://api-public.odpt.org/api/v4/gtfs/realtime/odpt_Kan_etsuTransportation_AllLines_';

export interface BusRealtime {
  tripUpdates: ReadonlyMap<string, RealtimeTripUpdate>;
  vehicles: ReadonlyMap<string, RealtimeVehicle>;
  /** header.timestamp(epoch 秒)。2 フィードの古い方。どちらも無ければ null */
  generatedAt: number | null;
}

async function fetchFeed<T>(
  name: string,
  decode: (bytes: Uint8Array) => RealtimeFeed<T>,
): Promise<RealtimeFeed<T> | null> {
  try {
    const res = await fetch(`${FEED_BASE}${name}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return decode(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

// 1 便に複数の停車の更新があっても、先頭(次に停まる停留所)だけを採る
function indexFirst<T extends { tripId: string }>(
  feed: RealtimeFeed<T> | null,
): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const e of feed?.entities ?? []) {
    if (!map.has(e.tripId)) map.set(e.tripId, e);
  }
  return map;
}

export async function fetchBusRealtime(): Promise<BusRealtime> {
  // 片方の失敗でもう片方を捨てないよう、fetchFeed 内で失敗を null に畳む
  const [trips, vehicles] = await Promise.all([
    fetchFeed('trip_update', decodeTripUpdates),
    fetchFeed('vehicle', decodeVehicles),
  ]);
  const stamps = [trips, vehicles].flatMap((f) => (f ? [f.generatedAt] : []));
  return {
    tripUpdates: indexFirst(trips),
    vehicles: indexFirst(vehicles),
    generatedAt: stamps.length > 0 ? Math.min(...stamps) : null,
  };
}

/** 一度も取得できていなければ null */
export function useBusRealtime(): BusRealtime | null {
  return usePolling<BusRealtime>({
    fetcher: fetchBusRealtime,
    intervalMs: BUS_REALTIME_INTERVAL_MS,
    initial: null,
    immediate: true,
  }).data;
}
