import type { PayloadRequest } from 'payload';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { hashCameraToken } from '../lib/parking-camera-token';
import { ingestHandler, parkingIngestEndpoints } from './parking-ingest';

const NOW = new Date('2026-10-10T01:03:00Z'); // JST 10:03
const nowSec = Math.floor(NOW.getTime() / 1000);
const TOKEN = 'tok-abc';
let jpeg: Buffer;

beforeAll(async () => {
  jpeg = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#888' } }).jpeg().toBuffer();
});

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function setup(opts: { camera?: Record<string, unknown> | null; claim?: boolean } = {}) {
  const camera =
    opts.camera === null
      ? null
      : { id: 3, lot: { id: 11 }, exposure_basis: null, last_judged_window: null, ...opts.camera };
  const payload = {
    find: vi.fn(async (args: Args) => ({
      docs: args.collection === 'parking_cameras' && camera ? [camera] : [],
    })),
    findGlobal: vi.fn().mockResolvedValue({ parking_monitor: { start: '09:00', end: '17:30' } }),
    create: vi.fn().mockResolvedValue({ id: 99 }),
    update: vi.fn(async (args: Args) => ({
      docs: args.where && (opts.claim ?? true) ? [{ id: 3 }] : [],
    })),
    delete: vi.fn().mockResolvedValue({}),
    jobs: { queue: vi.fn().mockResolvedValue({}) },
    logger: { warn: vi.fn() },
  };
  return { payload };
}

type Init = { headers?: Record<string, string | null | undefined>; body?: Buffer | null; auth?: string | null };
function request(payload: unknown, init: Init = {}) {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'image/jpeg',
    'x-exposure': '0',
    'x-captured-at': String(nowSec),
  });
  if (init.auth === null) headers.delete('authorization');
  else if (init.auth) headers.set('authorization', init.auth);
  for (const [k, v] of Object.entries(init.headers ?? {})) {
    if (v === null) headers.delete(k);
    else if (v !== undefined) headers.set(k, v);
  }
  const body = init.body === undefined ? jpeg : init.body;
  const r = new Request('http://localhost/api/parking-ingest', {
    method: 'POST',
    headers,
    body: body ? new Uint8Array(body) : null,
  });
  return Object.assign(r, { payload }) as unknown as PayloadRequest;
}

const handler = ingestHandler({ now: () => NOW, windowSeconds: 300 });
const run = async (init: Init = {}, opts: Parameters<typeof setup>[0] = {}) => {
  const s = setup(opts);
  const res = await handler(request(s.payload, init));
  return { res, ...s, json: await res.clone().json() };
};
const saved = (p: ReturnType<typeof setup>['payload']) => p.create.mock.calls.length > 0;

describe('登録', () => {
  it('POST /parking-ingest', () => {
    expect(parkingIngestEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual(['post /parking-ingest']);
  });
});

describe('認証', () => {
  it('トークンが無い・一致しないと 401 で何も保存しない', async () => {
    const a = await run({ auth: null });
    expect(a.res.status).toBe(401);
    expect(a.json).toEqual({ error: 'unauthorized' });
    expect(a.payload.find).not.toHaveBeenCalled();
    const b = await run({}, { camera: null });
    expect(b.res.status).toBe(401);
    expect(saved(b.payload)).toBe(false);
    expect(b.payload.update).not.toHaveBeenCalled();
  });

  it('トークンのハッシュでカメラを引く', async () => {
    const { payload } = await run();
    const where = (payload.find.mock.calls[0][0] as { where: unknown }).where;
    expect(where).toEqual({ token_hash: { equals: hashCameraToken(TOKEN) } });
  });

  it('認証後は 400・413・415・監視時間外でも device_status を全項目書き直す', async () => {
    for (const init of [
      { headers: { 'x-exposure': 'x', 'x-device-rssi': '-60' } },
      { headers: { 'content-length': String(2 * 1024 * 1024), 'x-device-rssi': '-60' } },
      { headers: { 'content-type': 'text/plain', 'x-device-rssi': '-60' } },
      { headers: { 'x-captured-at': String(nowSec - 3600), 'x-device-rssi': '-60' } },
    ]) {
      const { payload } = await run(init);
      const call = payload.update.mock.calls.find(
        (c) => (c[0] as { data: Record<string, unknown> }).data.device_status,
      );
      const status = (call![0] as { data: { device_status: Record<string, unknown> } }).data.device_status;
      expect(status).toMatchObject({ rssi: -60, uptime: null, failures: null, firmware: null, reset_reason: null });
      expect(status.received_at).toBe(NOW.toISOString());
    }
  });
});

describe('大きさと形式', () => {
  it('Content-Length が 1MiB 超なら本文を読まず 413', async () => {
    const { res, json, payload } = await run({ headers: { 'content-length': String(1024 * 1024 + 1) } });
    expect(res.status).toBe(413);
    expect(json).toEqual({ error: 'too_large' });
    expect(saved(payload)).toBe(false);
  });

  it('Content-Length が無くても 1MiB を超えたら 413、ちょうどは通る', async () => {
    const big = Buffer.alloc(1024 * 1024 + 1, 1);
    const over = await run({ body: big });
    expect(over.res.status).toBe(413);
    const exact = Buffer.concat([jpeg, Buffer.alloc(1024 * 1024 - jpeg.length)]);
    const ok = await run({ body: exact });
    expect(ok.res.status).toBe(200);
  });

  it('Content-Type 違い・先頭バイト違い・JPEG として読めない本文は 415', async () => {
    for (const init of [
      { headers: { 'content-type': 'image/png' } },
      { body: Buffer.from('not a jpeg at all') },
      { body: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('garbage')]) },
    ]) {
      const { res, json, payload } = await run(init);
      expect(res.status).toBe(415);
      expect(json).toEqual({ error: 'not_jpeg' });
      expect(saved(payload)).toBe(false);
    }
  });
});

describe('X-Exposure', () => {
  it('範囲外・小数・欠落は 400', async () => {
    for (const v of ['3', '-3', '1.5', '', 'a', null]) {
      const { res, json, payload } = await run({ headers: { 'x-exposure': v } });
      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'invalid_exposure' });
      expect(saved(payload)).toBe(false);
      expect(payload.jobs.queue).not.toHaveBeenCalled();
    }
  });

  it('-2〜2 は受け付ける', async () => {
    for (const v of ['-2', '0', '2']) expect((await run({ headers: { 'x-exposure': v } })).res.status).toBe(200);
  });
});

describe('X-Captured-At', () => {
  it('欠落・非整数・2 分超の未来・10 分超の過去は 400', async () => {
    for (const v of [null, '', 'abc', '1.5', String(nowSec + 121), String(nowSec - 601)]) {
      const { res, json, payload } = await run({ headers: { 'x-captured-at': v } });
      expect(res.status).toBe(400);
      expect(json).toEqual({ error: 'invalid_captured_at' });
      expect(saved(payload)).toBe(false);
    }
  });

  it('2 分ちょうどの未来・10 分ちょうどの過去は受け付ける', async () => {
    for (const v of [String(nowSec + 120), String(nowSec - 600)]) {
      expect((await run({ headers: { 'x-captured-at': v } })).res.status).toBe(200);
    }
  });
});

describe('監視時間', () => {
  it('外は 200 の {} で、保存・ジョブ・last_captured_at の更新をしない', async () => {
    const early = Math.floor(Date.parse('2026-10-09T23:59:00Z') / 1000); // JST 08:59
    const s = setup();
    const res = await ingestHandler({ now: () => new Date((early + 20) * 1000), windowSeconds: 300 })(
      request(s.payload, { headers: { 'x-captured-at': String(early) } }),
    );
    const { payload } = s;
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({});
    expect(saved(payload)).toBe(false);
    expect(payload.jobs.queue).not.toHaveBeenCalled();
    expect(
      payload.update.mock.calls.some((c) => 'last_captured_at' in (c[0] as { data: object }).data),
    ).toBe(false);
  });
});

describe('保存と判定の登録', () => {
  it('割り当てを写して保存し、枠を取れたらジョブを積む', async () => {
    const { res, json, payload } = await run();
    expect(res.status).toBe(200);
    expect(json).toEqual({});
    const args = payload.create.mock.calls[0][0] as {
      collection: string;
      data: Record<string, unknown>;
      file: { name: string; mimetype: string; size: number };
    };
    expect(args.collection).toBe('parking_snapshots');
    expect(args.data).toMatchObject({ camera: 3, lot: 11, exposure: 0, judge_status: 'pending' });
    expect(args.data.captured_at).toBe(new Date(nowSec * 1000).toISOString());
    expect(args.file.name).toMatch(/^[0-9a-f]{32}\.jpg$/);
    const claim = payload.update.mock.calls.find((c) => 'last_judged_window' in (c[0] as { data: object }).data);
    expect((claim![0] as { data: { last_judged_window: number } }).data.last_judged_window).toBe(
      Math.floor(nowSec / 300),
    );
    const job = payload.jobs.queue.mock.calls[0][0] as { task: string; input: { snapshotId: number; image: string } };
    expect(job.task).toBe('judgeParkingSnapshot');
    expect(job.input.snapshotId).toBe(99);
    expect(Buffer.from(job.input.image, 'base64').equals(jpeg)).toBe(true);
  });

  it('保存のあと last_captured_at を更新し、古い画像を消す', async () => {
    const { payload } = await run();
    expect(
      payload.update.mock.calls.some(
        (c) => (c[0] as { data: Record<string, unknown> }).data.last_captured_at === new Date(nowSec * 1000).toISOString(),
      ),
    ).toBe(true);
    const del = payload.delete.mock.calls[0][0] as { collection: string; where: unknown };
    expect(del.collection).toBe('parking_snapshots');
    expect(JSON.stringify(del.where)).toContain('not_equals');
  });

  it('枠を取れなければジョブを積まず same_window で見送る', async () => {
    const { res, payload } = await run({}, { claim: false });
    expect(res.status).toBe(200);
    expect(payload.jobs.queue).not.toHaveBeenCalled();
    const skip = payload.update.mock.calls.find((c) => (c[0] as { collection: string }).collection === 'parking_snapshots');
    expect((skip![0] as { id: number; data: unknown }).data).toEqual({
      judge_status: 'skipped',
      judge_error: 'same_window',
    });
  });

  it('枠の更新は「未設定か今回より小さい」を条件にする', async () => {
    const { payload } = await run();
    const claim = payload.update.mock.calls.find((c) => 'last_judged_window' in (c[0] as { data: object }).data);
    const where = JSON.stringify((claim![0] as { where: unknown }).where);
    expect(where).toContain('"exists":false');
    expect(where).toContain('less_than');
  });

  it('古い画像の削除に失敗しても 200', async () => {
    const s = setup();
    s.payload.delete.mockRejectedValue(new Error('boom'));
    const res = await handler(request(s.payload));
    expect(res.status).toBe(200);
    expect(s.payload.logger.warn).toHaveBeenCalled();
  });

  it('保存に失敗したら 500', async () => {
    const s = setup();
    s.payload.create.mockRejectedValue(new Error('boom'));
    const res = await handler(request(s.payload));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });
  });
});

describe('応答の露出補正値', () => {
  const basis = (quality: string, exposure: number, ageMs: number) => ({
    exposure_basis: { quality, exposure, captured_at: new Date(NOW.getTime() - ageMs).toISOString() },
  });

  it('起点から決め、割り当ての有無で分岐しない', async () => {
    for (const lot of [{ id: 11 }, null]) {
      const { json } = await run({}, { camera: { lot, ...basis('too_dark', 1, 60_000) } });
      expect(json).toEqual({ exposure: 2 });
    }
  });

  it('起点が無い・30 分超なら exposure のキーを含めない', async () => {
    expect((await run({}, { camera: basis('too_dark', 1, 31 * 60_000) })).json).toEqual({});
    expect((await run()).json).toEqual({});
  });
});
