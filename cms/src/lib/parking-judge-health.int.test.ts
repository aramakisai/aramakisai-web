import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

type Payload = Awaited<ReturnType<typeof import('payload').getPayload>>;
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!hasDatabase)('判定状態の記録 (実 DB)', () => {
  let payload: Payload;
  let camera: Any;

  const read = async () =>
    (await payload.findByID({ collection: 'parking_cameras', id: camera.id, depth: 0, overrideAccess: true })) as Any;

  // スナップショットは差し替え、カメラの更新だけ実 DB に流す
  const run = async (outcome: Any) => {
    const { runJudgeParkingSnapshot } = await import('./parking-judge-task');
    const fake = {
      find: vi.fn(),
      findByID: vi.fn(async () => ({ id: 1, camera: camera.id, lot: null })),
      update: vi.fn(async () => ({})),
      db: (payload as Any).db,
      logger: payload.logger,
    };
    await runJudgeParkingSnapshot({
      payload: fake as never,
      snapshotId: 1,
      image: '',
      judge: async () => outcome as never,
      now: () => new Date('2026-10-10T01:05:00Z'),
    });
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });
    camera = await payload.create({
      collection: 'parking_cameras',
      data: { name: `judge-health-${process.pid}` },
      overrideAccess: true,
    });
  });

  afterAll(async () => {
    if (camera) await payload.delete({ collection: 'parking_cameras', id: camera.id, overrideAccess: true });
  });

  it('並行する失敗を数え漏らさず、成功で 0 に戻る。last_error は成功で残る', async () => {
    expect((await read()).judge_health.consecutive_failures).toBe(0);
    await Promise.all(Array.from({ length: 20 }, () => run({ kind: 'failed', detail: 'boom' })));
    let c = await read();
    expect(Number(c.judge_health.consecutive_failures)).toBe(20);
    expect(c.judge_health.last_error).toBe('api_error: boom');
    expect(c.judge_health.last_failed_at).toBe('2026-10-10T01:05:00.000Z');

    await run({ kind: 'judged', model: 'm', congestion: null, quality: 'ok' });
    c = await read();
    expect(Number(c.judge_health.consecutive_failures)).toBe(0);
    expect(c.judge_health.last_succeeded_at).toBe('2026-10-10T01:05:00.000Z');
    expect(c.judge_health.last_error).toBe('api_error: boom');
  });
});
