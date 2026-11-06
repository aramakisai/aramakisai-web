import { createHash, timingSafeEqual } from 'node:crypto';

import type { Endpoint, PayloadHandler } from 'payload';

import { relationId } from '../collections/parking-cameras';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// 長さの違うトークンでも timingSafeEqual が使え、長さも漏らさないよう sha256 同士で比べる
const sha256 = (value: string) => createHash('sha256').update(value).digest();

const read = { depth: 0, pagination: false, overrideAccess: true } as const;

/** 読み取り専用。画像の URL・端末の詳細・トークンのハッシュは応答に載せない */
export function opsParkingHealthHandler(
  env: Record<string, string | undefined> = process.env,
  now: () => Date = () => new Date(),
): PayloadHandler {
  return async (req) => {
    const expected = env.OPS_PARKING_HEALTH_TOKEN;
    if (!expected) return Response.json({ error: 'not_configured' }, { status: 503 });

    const token = /^Bearer (\S+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
    if (!timingSafeEqual(sha256(token), sha256(expected))) return Response.json({ error: 'unauthorized' }, { status: 401 });

    try {
      const find = (collection: string) =>
        req.payload.find({ collection: collection as 'parking_cameras', ...read }) as unknown as Promise<{ docs: Row[] }>;
      const [cameras, lots, statuses] = await Promise.all([
        find('parking_cameras'),
        find('parking_lots'),
        find('parking_statuses'),
      ]);
      const lotName = new Map(lots.docs.map((l) => [String(l.id), l.name as string]));
      const statusUpdatedAt = new Map(statuses.docs.map((s) => [String(relationId(s.lot)), s.updatedAt as string]));

      return Response.json({
        generated_at: now().toISOString(),
        cameras: cameras.docs.map((c) => {
          const lot = relationId(c.lot);
          return {
            id: c.id,
            name: c.name,
            lot: lot === null ? null : (lotName.get(String(lot)) ?? null),
            last_captured_at: c.last_captured_at ?? null,
            device_received_at: c.device_status?.received_at ?? null,
            judge_last_succeeded_at: c.judge_health?.last_succeeded_at ?? null,
            judge_last_failed_at: c.judge_health?.last_failed_at ?? null,
            judge_last_error: c.judge_health?.last_error ?? null,
            judge_consecutive_failures: Number(c.judge_health?.consecutive_failures ?? 0),
            lot_status_updated_at: lot === null ? null : (statusUpdatedAt.get(String(lot)) ?? null),
          };
        }),
      });
    } catch (err) {
      req.payload.logger.warn(`ops-parking-health: read failed: ${String(err)}`);
      return Response.json({ error: 'internal' }, { status: 500 });
    }
  };
}

export const opsParkingHealthEndpoints: Endpoint[] = [
  { path: '/ops/parking-health', method: 'get', handler: opsParkingHealthHandler() },
];
