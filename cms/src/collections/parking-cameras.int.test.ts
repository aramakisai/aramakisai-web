import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

type Payload = Awaited<ReturnType<typeof import('payload').getPayload>>;
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasDatabase)('駐車場カメラの割り当てと access', () => {
  let payload: Payload;
  let jpeg: Buffer;
  let executive: Any;
  let student: Any;
  let execJwt: string;
  let studentJwt: string;
  let restGet: (req: Request, ctx: { params: Promise<{ slug: string[] }> }) => Promise<Response>;

  const suffix = String(process.pid);
  const lots: Any[] = [];
  const cameras: Any[] = [];

  const createLot = async (name: string) => {
    const lot = (await payload.create({ collection: 'parking_lots', data: { name }, overrideAccess: true })) as Any;
    lots.push(lot);
    const status = (
      await payload.find({ collection: 'parking_statuses', where: { lot: { equals: lot.id } }, overrideAccess: true })
    ).docs[0] as Any;
    return { lot, status };
  };
  const createCamera = async (name: string, lot: number | null) => {
    const camera = (await payload.create({ collection: 'parking_cameras', data: { name, lot }, overrideAccess: true })) as Any;
    cameras.push(camera);
    return camera;
  };
  const createSnapshot = async (camera: Any, lot: number | null) =>
    (await payload.create({
      collection: 'parking_snapshots',
      data: {
        camera: camera.id,
        lot,
        exposure: 0,
        captured_at: new Date().toISOString(),
        judge_status: 'succeeded',
        judge_error: 'x',
        congestion: 'full',
        image_quality: 'ok',
        judge_model: 'm',
      },
      file: { data: jpeg, mimetype: 'image/jpeg', name: `${suffix}-${Math.random().toString(16).slice(2)}.jpg`, size: jpeg.length },
      overrideAccess: true,
    })) as Any;
  const anonymousSnapshots = async () =>
    (await payload.find({ collection: 'parking_snapshots', overrideAccess: false, pagination: false })).docs as Any[];
  const rest = (path: string, jwt: string | null = null) =>
    restGet(new Request(`http://localhost/api/${path}`, { headers: jwt ? { authorization: `JWT ${jwt}` } : {} }), {
      params: Promise.resolve({ slug: path.split('?')[0].split('/') }),
    });

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });
    const { REST_GET } = await import('@payloadcms/next/routes');
    restGet = REST_GET(config) as never;
    jpeg = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#888' } }).jpeg().toBuffer();

    const createUser = async (email: string, role: 'executive' | 'student_exhibitor') =>
      (await payload.create({
        collection: 'users',
        data: { email, password: 'test-password', role },
        overrideAccess: true,
      })) as Any;
    executive = await createUser(`cam-exec-${suffix}@test.local`, 'executive');
    student = await createUser(`cam-student-${suffix}@test.local`, 'student_exhibitor');
    // 学生団体のパスワードは作成時にランダム値へ置き換わるため、ログイン用に設定し直す
    await payload.update({ collection: 'users', id: student.id, data: { password: 'test-password' }, overrideAccess: true });
    const login = async (email: string) =>
      (await payload.login({ collection: 'users', data: { email, password: 'test-password' } })).token as string;
    execJwt = await login(executive.email);
    studentJwt = await login(student.email);
  });

  afterAll(async () => {
    for (const u of [executive, student]) {
      if (u?.id) await payload.delete({ collection: 'users', id: u.id, overrideAccess: true }).catch(() => null);
    }
  });

  beforeEach(() => {
    lots.length = 0;
    cameras.length = 0;
  });

  afterEach(async () => {
    for (const c of cameras) {
      await payload.delete({ collection: 'parking_cameras', id: c.id, overrideAccess: true }).catch(() => null);
    }
    for (const l of lots) {
      await payload.delete({ collection: 'parking_lots', id: l.id, overrideAccess: true }).catch(() => null);
    }
  });

  it('割り当て済みの駐車場に2台目を割り当てると lot 欄の検証エラーで失敗する', async () => {
    const { lot } = await createLot(`cam-lot-${suffix}`);
    await createCamera(`cam-a-${suffix}`, lot.id);

    const err = await payload
      .create({ collection: 'parking_cameras', data: { name: `cam-b-${suffix}`, lot: lot.id }, overrideAccess: true })
      .then(() => null, (e: Any) => e);
    expect(err?.name).toBe('ValidationError');
    expect(err!.data.errors.map((e: Any) => e.path)).toEqual(['lot']);

    // 未割り当て同士は何台あってもよい
    await createCamera(`cam-free1-${suffix}`, null);
    await createCamera(`cam-free2-${suffix}`, null);
  });

  it('カメラの無い駐車場の空き状況は実行委員の手入力で状態と更新時刻が更新される', async () => {
    const { status } = await createLot(`cam-nocam-${suffix}`);
    const before = (await payload.findByID({ collection: 'parking_statuses', id: status.id, overrideAccess: true })) as Any;
    expect(before.status ?? null).toBeNull();

    await payload.update({
      collection: 'parking_statuses',
      id: status.id,
      data: { status: 'crowded' },
      user: executive as never,
      overrideAccess: false,
    });
    const after = (await payload.findByID({ collection: 'parking_statuses', id: status.id, overrideAccess: true })) as Any;
    expect(after.status).toBe('crowded');
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
  });

  it('駐車場の camera (join) は実行委員にはカメラが入り、未認証では空になる', async () => {
    const { lot } = await createLot(`cam-join-${suffix}`);
    const camera = await createCamera(`cam-join-c-${suffix}`, lot.id);

    const asExecutive = (await payload.findByID({
      collection: 'parking_lots',
      id: lot.id,
      depth: 1,
      user: executive as never,
      overrideAccess: false,
    })) as Any;
    expect(asExecutive.camera.docs.map((c: Any) => c.id)).toEqual([camera.id]);

    const anonymous = (await payload.findByID({
      collection: 'parking_lots',
      id: lot.id,
      depth: 1,
      overrideAccess: false,
    })) as Any;
    expect(anonymous.camera?.docs ?? []).toEqual([]);
  });

  it('未認証・学生団体はカメラを読めず、トークンのハッシュは実行委員の応答にも出ない', async () => {
    const { lot } = await createLot(`cam-acl-${suffix}`);
    const camera = await createCamera(`cam-acl-c-${suffix}`, lot.id);
    const { hashCameraToken } = await import('../lib/parking-camera-token');
    await payload.update({
      collection: 'parking_cameras',
      id: camera.id,
      data: { token_hash: hashCameraToken('secret-token'), device_status: { rssi: -60 } },
      overrideAccess: true,
    });

    // 受信エンドポイントはフィールド access で誰にも読ませない token_hash を where に使って引く
    const byHash = await payload.find({
      collection: 'parking_cameras',
      where: { token_hash: { equals: hashCameraToken('secret-token') } },
      depth: 0,
      overrideAccess: true,
    });
    expect(byHash.docs.map((c) => c.id)).toEqual([camera.id]);

    expect((await rest(`parking_cameras/${camera.id}`)).status).toBe(403);
    expect((await rest('parking_cameras')).status).toBe(403);
    expect((await rest(`parking_cameras/${camera.id}`, studentJwt)).status).toBe(403);
    expect((await rest('parking_cameras', studentJwt)).status).toBe(403);

    const one = await rest(`parking_cameras/${camera.id}`, execJwt);
    expect(one.status).toBe(200);
    const body = (await one.json()) as Any;
    expect(body.device_status.rssi).toBe(-60);
    expect(body).not.toHaveProperty('token_hash');
    const list = await rest('parking_cameras', execJwt);
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as Any;
    expect(listBody.docs.some((c: Any) => c.id === camera.id)).toBe(true);
    expect(JSON.stringify(listBody)).not.toContain(hashCameraToken('secret-token'));
  });

  it('画像の判定の項目は未認証に出ず、割り当てを外す・カメラを削除すると未認証の一覧から消える', async () => {
    const { lot } = await createLot(`cam-snap-${suffix}`);
    const camera = await createCamera(`cam-snap-c-${suffix}`, lot.id);
    const snap = await createSnapshot(camera, lot.id);

    const visible = (await anonymousSnapshots()).find((s) => s.id === snap.id);
    expect(visible).toBeTruthy();
    for (const key of ['judge_status', 'judge_error', 'congestion', 'image_quality', 'judge_model', 'judged_at', 'camera', 'exposure']) {
      expect(visible, key).not.toHaveProperty(key);
    }
    expect(visible!.captured_at).toBeTruthy();

    await payload.update({ collection: 'parking_cameras', id: camera.id, data: { lot: null }, overrideAccess: true });
    expect((await anonymousSnapshots()).some((s) => s.id === snap.id)).toBe(false);

    // 付け替えた先でも、割り当て前に撮った画像は公開されない
    const other = await createLot(`cam-snap-other-${suffix}`);
    await payload.update({ collection: 'parking_cameras', id: camera.id, data: { lot: other.lot.id }, overrideAccess: true });
    expect((await anonymousSnapshots()).some((s) => s.id === snap.id)).toBe(false);

    const second = await createSnapshot(camera, other.lot.id);
    expect((await anonymousSnapshots()).some((s) => s.id === second.id)).toBe(true);
    await payload.delete({ collection: 'parking_cameras', id: camera.id, overrideAccess: true });
    expect((await anonymousSnapshots()).some((s) => s.id === second.id)).toBe(false);
    const left = await payload.find({
      collection: 'parking_snapshots',
      where: { id: { in: [snap.id, second.id] } },
      overrideAccess: true,
    });
    expect(left.totalDocs).toBe(0);
  });

  it('駐車場を削除するとカメラと画像の割り当て先が空になりカメラは残る', async () => {
    const { lot } = await createLot(`cam-del-${suffix}`);
    const camera = await createCamera(`cam-del-c-${suffix}`, lot.id);
    const snap = await createSnapshot(camera, lot.id);

    await payload.delete({ collection: 'parking_lots', id: lot.id, overrideAccess: true });

    const cam = (await payload.findByID({ collection: 'parking_cameras', id: camera.id, depth: 0, overrideAccess: true })) as Any;
    expect(cam.lot ?? null).toBeNull();
    const s = (await payload.findByID({ collection: 'parking_snapshots', id: snap.id, depth: 0, overrideAccess: true })) as Any;
    expect(s.lot ?? null).toBeNull();
  });
});
