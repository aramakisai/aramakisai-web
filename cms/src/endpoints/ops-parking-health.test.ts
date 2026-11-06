import type { PayloadRequest } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { opsParkingHealthEndpoints, opsParkingHealthHandler } from './ops-parking-health';

const env = { OPS_PARKING_HEALTH_TOKEN: 'secret-token' };
const now = () => new Date('2026-10-10T01:00:00Z');

const cameras = [
  {
    id: 3,
    name: '4階東側',
    lot: 11,
    token_hash: 'HASH',
    last_captured_at: '2026-10-10T00:58:00.000Z',
    image_url: 'https://example.invalid/a.jpg',
    device_status: { rssi: -60, uptime: 10, log: 'x', firmware: '1', received_at: '2026-10-10T00:58:05.000Z' },
    judge_health: {
      last_succeeded_at: '2026-10-10T00:55:00.000Z',
      last_failed_at: null,
      last_error: null,
      consecutive_failures: 0,
    },
  },
  { id: 4, name: '予備', lot: null, device_status: {}, judge_health: {} },
];

function req(auth?: string) {
  const find = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'parking_cameras') return { docs: cameras };
    if (collection === 'parking_lots') return { docs: [{ id: 11, name: '第1駐車場' }] };
    return { docs: [{ id: 21, lot: 11, status: 'crowded', updatedAt: '2026-10-10T00:56:00.000Z' }] };
  });
  const r = {
    headers: new Headers(auth === undefined ? {} : { authorization: auth }),
    payload: { find, logger: { warn: vi.fn() } },
  } as unknown as PayloadRequest;
  return { r, find };
}

describe('エンドポイントの登録', () => {
  it('GET /ops/parking-health だけ', () => {
    expect(opsParkingHealthEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual(['get /ops/parking-health']);
  });
});

describe('opsParkingHealthHandler', () => {
  it('トークン未設定は 503 not_configured (認証より先)', async () => {
    const { r, find } = req('Bearer x');
    const res = await opsParkingHealthHandler({}, now)(r);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not_configured' });
    expect(find).not.toHaveBeenCalled();
  });

  it('Authorization が無い・形式違い・不一致は 401 で、DB を読まない', async () => {
    for (const auth of [undefined, 'secret-token', 'Basic secret-token', 'Bearer wrong', 'Bearer secret-token-longer', 'Bearer ']) {
      const { r, find } = req(auth);
      const res = await opsParkingHealthHandler(env, now)(r);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
      expect(find).not.toHaveBeenCalled();
    }
  });

  it('一致すればカメラごとの状態を depth 0・overrideAccess で読んで返す', async () => {
    const { r, find } = req('Bearer secret-token');
    const res = await opsParkingHealthHandler(env, now)(r);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      generated_at: '2026-10-10T01:00:00.000Z',
      cameras: [
        {
          id: 3,
          name: '4階東側',
          lot: '第1駐車場',
          last_captured_at: '2026-10-10T00:58:00.000Z',
          device_received_at: '2026-10-10T00:58:05.000Z',
          judge_last_succeeded_at: '2026-10-10T00:55:00.000Z',
          judge_last_failed_at: null,
          judge_last_error: null,
          judge_consecutive_failures: 0,
          lot_status_updated_at: '2026-10-10T00:56:00.000Z',
        },
        {
          id: 4,
          name: '予備',
          lot: null,
          last_captured_at: null,
          device_received_at: null,
          judge_last_succeeded_at: null,
          judge_last_failed_at: null,
          judge_last_error: null,
          judge_consecutive_failures: 0,
          lot_status_updated_at: null,
        },
      ],
    });
    for (const [args] of find.mock.calls) {
      expect(args).toMatchObject({ depth: 0, overrideAccess: true });
    }
  });

  it('トークンのハッシュ・端末の詳細・画像の URL を含めない', async () => {
    const { r } = req('Bearer secret-token');
    const text = await (await opsParkingHealthHandler(env, now)(r)).text();
    for (const leaked of ['HASH', 'rssi', 'uptime', 'firmware', 'image_url', 'token', '"log"']) {
      expect(text).not.toContain(leaked);
    }
  });

  it('読み取りの失敗は 500 internal', async () => {
    const { r, find } = req('Bearer secret-token');
    find.mockRejectedValue(new Error('db down'));
    const res = await opsParkingHealthHandler(env, now)(r);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });
});
