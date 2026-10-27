import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

type Payload = Awaited<ReturnType<typeof import('payload').getPayload>>;
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// JST 10:00。監視時間 (09:00-17:30) の内側
const BASE = Date.parse('2026-10-10T01:00:00Z') / 1000;
const WINDOW = 300;

describe.skipIf(!hasDatabase)('駐車場カメラの受信から判定まで', () => {
  let payload: Payload;
  let jpeg: Buffer;
  let wideJpeg: Buffer;
  let executive: Any;
  let originalMonitor: Any | undefined;
  let ingestHandler: typeof import('./parking-ingest').ingestHandler;
  let tokenHandler: typeof import('./parking-camera-token').tokenHandler;
  let restGet: (req: Request, ctx: { params: Promise<{ slug: string[] }> }) => Promise<Response>;

  const suffix = String(process.pid);
  let lot: Any;
  let status: Any;
  let camera: Any;
  let token: string;
  const extraLots: Any[] = [];
  const extraCameras: Any[] = [];

  let gemini: Any;
  let geminiBodies: Any[];

  const readStatus = async (id = status.id) =>
    (await payload.findByID({ collection: 'parking_statuses', id, depth: 0, overrideAccess: true })) as Any;
  const readCamera = async (id = camera.id) =>
    (await payload.findByID({ collection: 'parking_cameras', id, depth: 0, overrideAccess: true })) as Any;
  const snapshotsOf = async (id = camera.id) =>
    (
      await payload.find({
        collection: 'parking_snapshots',
        where: { camera: { equals: id } },
        sort: 'createdAt',
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
    ).docs as Any[];
  const queuedJudgeJobs = async () =>
    (await payload.count({ collection: 'payload-jobs', where: { taskSlug: { equals: 'judgeParkingSnapshot' } } })).totalDocs;

  const issueToken = async (cameraId: number): Promise<string> => {
    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({ user: executive as never }, payload);
    Object.assign(req, { routeParams: { id: String(cameraId) } });
    const res = (await tokenHandler('post')(req)) as Response;
    expect(res.status).toBe(200);
    return ((await res.json()) as { token: string }).token;
  };

  async function ingest(
    bearer: string | null,
    opts: { captured: number; received?: number; headers?: Record<string, string>; body?: Buffer; exposure?: string } = {
      captured: BASE,
    },
  ) {
    const received = (opts.received ?? opts.captured + 30) * 1000;
    const headers = new Headers({
      'content-type': 'image/jpeg',
      'x-exposure': opts.exposure ?? '0',
      'x-captured-at': String(opts.captured),
      ...opts.headers,
    });
    if (bearer) headers.set('authorization', `Bearer ${bearer}`);
    const req = Object.assign(
      new Request('http://localhost/api/parking-ingest', {
        method: 'POST',
        headers,
        body: new Uint8Array(opts.body ?? jpeg),
      }),
      { payload },
    );
    const res = await ingestHandler({ now: () => new Date(received), windowSeconds: WINDOW })(req as never);
    return { status: res.status, json: (await res.json()) as Any };
  }

  async function runJobs() {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      geminiBodies.push(body);
      const quality = body.generationConfig.responseSchema.properties.congestion ? gemini : { image_quality: gemini.image_quality };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(quality) }] } }] }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await payload.jobs.run();
    } finally {
      vi.unstubAllGlobals();
    }
    return fetchMock.mock.calls.length;
  }

  const createCamera = async (name: string, lotId: number | null) =>
    (await payload.create({
      collection: 'parking_cameras',
      data: { name, lot: lotId },
      overrideAccess: true,
    })) as Any;
  const createLot = async (name: string) => {
    const l = (await payload.create({ collection: 'parking_lots', data: { name }, overrideAccess: true })) as Any;
    extraLots.push(l);
    const s = (
      await payload.find({ collection: 'parking_statuses', where: { lot: { equals: l.id } }, overrideAccess: true })
    ).docs[0] as Any;
    return { lot: l, status: s };
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });
    ({ ingestHandler } = await import('./parking-ingest'));
    ({ tokenHandler } = await import('./parking-camera-token'));
    const { REST_GET } = await import('@payloadcms/next/routes');
    restGet = REST_GET(config) as never;

    jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#888' } }).jpeg().toBuffer();
    wideJpeg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#468' } }).jpeg().toBuffer();
    process.env.GEMINI_API_KEY = 'test-key';

    executive = await payload.create({
      collection: 'users',
      data: { email: `ingest-exec-${suffix}@test.local`, password: 'test-password', role: 'executive' },
      overrideAccess: true,
    });
    originalMonitor = (await payload.findGlobal({ slug: 'site_settings', depth: 0, overrideAccess: true })).parking_monitor;
    await payload.updateGlobal({
      slug: 'site_settings',
      data: { parking_monitor: { start: '09:00', end: '17:30' } },
      overrideAccess: true,
    });
  });

  afterAll(async () => {
    if (originalMonitor) {
      await payload.updateGlobal({ slug: 'site_settings', data: { parking_monitor: originalMonitor }, overrideAccess: true });
    }
    if (executive?.id) await payload.delete({ collection: 'users', id: executive.id, overrideAccess: true }).catch(() => null);
    delete process.env.GEMINI_API_KEY;
  });

  beforeEach(async () => {
    gemini = { congestion: 'full', image_quality: 'too_dark' };
    geminiBodies = [];
    await payload.delete({ collection: 'payload-jobs', where: { id: { exists: true } }, overrideAccess: true });
    ({ lot, status } = await createLot(`ingest-lot-${suffix}`));
    camera = await createCamera(`ingest-cam-${suffix}`, lot.id);
    extraCameras.push(camera);
    token = await issueToken(camera.id);
  });

  afterEach(async () => {
    for (const c of extraCameras.splice(0)) {
      await payload.delete({ collection: 'parking_cameras', id: c.id, overrideAccess: true }).catch(() => null);
    }
    for (const l of extraLots.splice(0)) {
      await payload.delete({ collection: 'parking_lots', id: l.id, overrideAccess: true }).catch(() => null);
    }
    await payload.delete({ collection: 'payload-jobs', where: { id: { exists: true } }, overrideAccess: true });
  });

  it('受信 → 画像1枚だけが残る → ジョブ実行 → 空き状況と更新時刻が更新される', async () => {
    const before = await readStatus();
    expect(before.status ?? null).toBeNull();

    const first = await ingest(token, { captured: BASE });
    expect(first).toEqual({ status: 200, json: {} });
    expect(await queuedJudgeJobs()).toBe(1);
    expect(await runJobs()).toBe(1);

    const after = await readStatus();
    expect(after.status).toBe('full');
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
    const [snap] = await snapshotsOf();
    expect(snap).toMatchObject({ judge_status: 'succeeded', congestion: 'full', image_quality: 'too_dark' });
    expect(snap.lot).toBe(lot.id);
    expect(geminiBodies[0].generationConfig.responseSchema.properties.congestion).toBeTruthy();

    const second = await ingest(token, { captured: BASE + WINDOW });
    // 起点 (too_dark, 0) の次は +1
    expect(second).toEqual({ status: 200, json: { exposure: 1 } });
    const remained = await snapshotsOf();
    expect(remained).toHaveLength(1);
    expect(remained[0].id).not.toBe(snap.id);
    expect(Date.parse((await readCamera()).last_captured_at)).toBe((BASE + WINDOW) * 1000);
  });

  it('同じ枠の2枚目は見送り、次の枠は判定し、遅れて届いた古い枠は判定しない', async () => {
    await ingest(token, { captured: BASE });
    await runJobs();
    const settled = await readStatus();
    expect(settled.status).toBe('full');

    gemini = { congestion: 'available', image_quality: 'ok' };
    const same = await ingest(token, { captured: BASE + 60 });
    expect(same.status).toBe(200);
    expect(await queuedJudgeJobs()).toBe(0);
    const [skipped] = await snapshotsOf();
    expect(skipped).toMatchObject({ judge_status: 'skipped', judge_error: 'same_window' });
    expect(await runJobs()).toBe(0);
    const unchanged = await readStatus();
    expect(unchanged.status).toBe('full');
    expect(unchanged.updatedAt).toBe(settled.updatedAt);

    await ingest(token, { captured: BASE + WINDOW });
    expect(await queuedJudgeJobs()).toBe(1);
    await runJobs();
    expect((await readStatus()).status).toBe('available');

    gemini = { congestion: 'crowded', image_quality: 'ok' };
    await ingest(token, { captured: BASE + 10, received: BASE + WINDOW + 30 });
    expect(await queuedJudgeJobs()).toBe(0);
    const [late] = await snapshotsOf();
    expect(late).toMatchObject({ judge_status: 'skipped', judge_error: 'same_window' });
    expect((await readStatus()).status).toBe('available');
  });

  it('同時に届いた同じ枠の2枚は1枚だけが判定に積まれる', async () => {
    const results = await Promise.all([
      ingest(token, { captured: BASE }),
      ingest(token, { captured: BASE + 1 }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await queuedJudgeJobs()).toBe(1);
  });

  it('invalid_captured_at の画像は保存されず、監視時間外は200の{}で何も変えない', async () => {
    const bad = await ingest(token, { captured: BASE - 700, received: BASE });
    expect(bad).toEqual({ status: 400, json: { error: 'invalid_captured_at' } });
    expect(await snapshotsOf()).toHaveLength(0);
    expect(await queuedJudgeJobs()).toBe(0);

    await ingest(token, { captured: BASE });
    await runJobs();
    const snapsBefore = await snapshotsOf();
    const cameraBefore = await readCamera();
    expect(cameraBefore.exposure_basis.quality).toBe('too_dark');

    // JST 08:50
    const outside = BASE - 70 * 60;
    const res = await ingest(token, { captured: outside, received: outside + 30 });
    expect(res).toEqual({ status: 200, json: {} });
    expect((await snapshotsOf()).map((s) => s.id)).toEqual(snapsBefore.map((s) => s.id));
    expect(await queuedJudgeJobs()).toBe(0);
    const cameraAfter = await readCamera();
    expect(cameraAfter.exposure_basis).toEqual(cameraBefore.exposure_basis);
    expect(cameraAfter.last_captured_at).toBe(cameraBefore.last_captured_at);
  });

  it('端末状態を書き直し、不正な項目は値なしで200、400・監視時間外でも保存される', async () => {
    const received = BASE + 30;
    const ok = await ingest(token, {
      captured: BASE,
      headers: {
        'x-device-rssi': '-61',
        'x-device-uptime': '3600',
        'x-device-reset-reason': 'POWERON',
        'x-device-failures': '2',
        'x-device-firmware': 'v1.2.3',
      },
    });
    expect(ok.status).toBe(200);
    expect((await readCamera()).device_status).toMatchObject({
      rssi: -61,
      uptime: 3600,
      reset_reason: 'POWERON',
      failures: 2,
      firmware: 'v1.2.3',
    });
    expect(Date.parse((await readCamera()).device_status.received_at)).toBe(received * 1000);

    const partial = await ingest(token, {
      captured: BASE + WINDOW,
      headers: { 'x-device-rssi': '-61.5', 'x-device-uptime': '10', 'x-device-reset-reason': 'bad reason', 'x-device-firmware': 'v2' },
    });
    expect(partial.status).toBe(200);
    const d = (await readCamera()).device_status;
    expect(d).toMatchObject({ uptime: 10, firmware: 'v2' });
    expect(d.rssi ?? null).toBeNull();
    expect(d.reset_reason ?? null).toBeNull();
    expect(d.failures ?? null).toBeNull();

    const invalid = await ingest(token, { captured: BASE, exposure: '9', headers: { 'x-device-uptime': '11' } });
    expect(invalid.json).toEqual({ error: 'invalid_exposure' });
    expect((await readCamera()).device_status.uptime).toBe(11);

    const outside = BASE - 70 * 60;
    const out = await ingest(token, { captured: outside, received: outside + 30, headers: { 'x-device-uptime': '12' } });
    expect(out).toEqual({ status: 200, json: {} });
    const after = (await readCamera()).device_status;
    expect(after.uptime).toBe(12);
    expect(Date.parse(after.received_at)).toBe((outside + 30) * 1000);
  });

  it('トークンを発行し直すと古い値が、無効化すると新しい値が401になる', async () => {
    expect((await ingest(token, { captured: BASE })).status).toBe(200);
    const oldToken = token;
    const renewed = await issueToken(camera.id);
    expect((await ingest(oldToken, { captured: BASE + WINDOW })).status).toBe(401);
    expect((await ingest(renewed, { captured: BASE + WINDOW })).status).toBe(200);

    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({ user: executive as never }, payload);
    Object.assign(req, { routeParams: { id: String(camera.id) } });
    expect(((await tokenHandler('delete')(req)) as Response).status).toBe(204);
    expect((await ingest(renewed, { captured: BASE + 2 * WINDOW })).status).toBe(401);
    expect((await ingest(null, { captured: BASE })).status).toBe(401);
  });

  it('幅960のWebP縮小版が未認証で取れ、新しい画像の受信で古い画像の原寸と縮小版が消える', async () => {
    await ingest(token, { captured: BASE, body: wideJpeg });
    const [snap] = await snapshotsOf();
    expect(snap.sizes.web).toMatchObject({ width: 960, mimeType: 'image/webp' });

    const file = (name: string) =>
      restGet(new Request(`http://localhost/api/parking_snapshots/file/${name}`), {
        params: Promise.resolve({ slug: ['parking_snapshots', 'file', name] }),
      });
    const thumb = await file(snap.sizes.web.filename);
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get('content-type')).toBe('image/webp');
    expect(thumb.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await file(snap.filename)).status).toBe(200);

    await ingest(token, { captured: BASE + WINDOW, body: wideJpeg });
    // 読めない文書は未認証には 403 で返る
    expect((await file(snap.filename)).status).not.toBe(200);
    expect((await file(snap.sizes.web.filename)).status).not.toBe(200);
  });

  describe('割り当てのないカメラ', () => {
    it('画像は保存されて補正値が返り、未認証では読めず、写り具合だけ判定して起点だけ更新する', async () => {
      const bystander = await createLot(`ingest-bystander-${suffix}`);
      const bystanderBefore = await readStatus(bystander.status.id);
      const free = await createCamera(`ingest-free-${suffix}`, null);
      extraCameras.push(free);
      const freeToken = await issueToken(free.id);

      expect((await ingest(freeToken, { captured: BASE })).json).toEqual({});
      const [snap] = await snapshotsOf(free.id);
      expect(snap).toBeTruthy();
      expect(snap.lot ?? null).toBeNull();
      const anonymous = await payload.find({
        collection: 'parking_snapshots',
        where: { id: { equals: snap.id } },
        overrideAccess: false,
      });
      expect(anonymous.docs).toHaveLength(0);

      await runJobs();
      expect(geminiBodies).toHaveLength(1);
      const props = geminiBodies[0].generationConfig.responseSchema.properties;
      expect(Object.keys(props)).toEqual(['image_quality']);
      expect((await readCamera(free.id)).exposure_basis).toMatchObject({ quality: 'too_dark', exposure: 0 });
      expect((await snapshotsOf(free.id))[0]).toMatchObject({ judge_status: 'succeeded', image_quality: 'too_dark' });
      expect((await snapshotsOf(free.id))[0].congestion ?? null).toBeNull();
      expect((await ingest(freeToken, { captured: BASE + WINDOW })).json).toEqual({ exposure: 1 });

      for (const [s, before] of [
        [status, await readStatus()],
        [bystander.status, bystanderBefore],
      ] as const) {
        const now = await readStatus(s.id);
        expect(now.status ?? null).toBe(before.status ?? null);
        expect(now.updatedAt).toBe(before.updatedAt);
      }
    });
  });

  describe('判定中の割り当て変更', () => {
    it('割り当てを外すと元の駐車場の空き状況は変わらない', async () => {
      await ingest(token, { captured: BASE });
      await payload.update({ collection: 'parking_cameras', id: camera.id, data: { lot: null }, overrideAccess: true });
      const before = await readStatus();
      await runJobs();
      const after = await readStatus();
      expect(after.status ?? null).toBeNull();
      expect(after.updatedAt).toBe(before.updatedAt);
    });

    it('別の駐車場へ付け替えると、元も付け替え先も空き状況は変わらない', async () => {
      const other = await createLot(`ingest-other-${suffix}`);
      await ingest(token, { captured: BASE });
      await payload.update({ collection: 'parking_cameras', id: camera.id, data: { lot: other.lot.id }, overrideAccess: true });
      const beforeOriginal = await readStatus();
      const beforeOther = await readStatus(other.status.id);
      await runJobs();
      expect((await readStatus()).updatedAt).toBe(beforeOriginal.updatedAt);
      const afterOther = await readStatus(other.status.id);
      expect(afterOther.status ?? null).toBeNull();
      expect(afterOther.updatedAt).toBe(beforeOther.updatedAt);
    });
  });
});
