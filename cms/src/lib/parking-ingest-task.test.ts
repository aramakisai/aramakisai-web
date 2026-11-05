import { describe, expect, it, vi } from 'vitest';

import { runIngestParkingSnapshot } from './parking-ingest-task';

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const jpeg = Buffer.from('jpeg');
const CAPTURED = '2026-10-10T01:03:00.000Z';

function setup(opts: { claim?: boolean } = {}) {
  const payload = {
    create: vi.fn().mockResolvedValue({ id: 99 }),
    update: vi.fn(async (_args: Args) => ({})),
    delete: vi.fn().mockResolvedValue({}),
    db: { pool: { query: vi.fn(async (_sql: string, _params: unknown[]) => ({ rowCount: (opts.claim ?? true) ? 1 : 0 })) } },
    jobs: { queue: vi.fn().mockResolvedValue({}) },
    logger: { warn: vi.fn() },
  };
  return { payload };
}

const run = (s: ReturnType<typeof setup>, over: { lot?: number | null } = {}) =>
  runIngestParkingSnapshot({
    payload: s.payload,
    cameraId: 3,
    lot: over.lot === undefined ? 11 : over.lot,
    exposure: 1,
    capturedAt: CAPTURED,
    window: 7,
    image: jpeg.toString('base64'),
  });

describe('ingestParkingSnapshot', () => {
  it('割り当てを写して保存し、枠を取れたら判定のジョブを積む', async () => {
    const s = setup();
    await run(s);
    const args = s.payload.create.mock.calls[0][0] as Args;
    expect(args.collection).toBe('parking_snapshots');
    expect(args.data).toEqual({ camera: 3, lot: 11, exposure: 1, captured_at: CAPTURED, judge_status: 'pending' });
    expect(args.file).toMatchObject({ mimetype: 'image/jpeg', size: jpeg.length });
    expect(args.file.name).toMatch(/^[0-9a-f]{32}\.jpg$/);
    expect(args.file.data.equals(jpeg)).toBe(true);
    expect(s.payload.db.pool.query.mock.calls[0][1]).toEqual([7, 3]);
    const job = s.payload.jobs.queue.mock.calls[0][0] as Args;
    expect(job.task).toBe('judgeParkingSnapshot');
    expect(job.input.snapshotId).toBe(99);
    expect(job.input.image).toBe(jpeg.toString('base64'));
  });

  it('保存のあと last_captured_at を更新し、同じカメラの古い画像を消す', async () => {
    const s = setup();
    await run(s);
    expect(s.payload.update.mock.calls[0][0]).toMatchObject({
      collection: 'parking_cameras',
      id: 3,
      data: { last_captured_at: CAPTURED },
    });
    const del = s.payload.delete.mock.calls[0][0] as Args;
    expect(del.collection).toBe('parking_snapshots');
    expect(del.where).toEqual({ and: [{ camera: { equals: 3 } }, { id: { not_equals: 99 } }] });
  });

  it('割り当てのないカメラは lot を null のまま保存する', async () => {
    const s = setup();
    await run(s, { lot: null });
    expect((s.payload.create.mock.calls[0][0] as Args).data.lot).toBeNull();
  });

  it('枠を取れなければジョブを積まず same_window で見送る', async () => {
    const s = setup({ claim: false });
    await run(s);
    expect(s.payload.jobs.queue).not.toHaveBeenCalled();
    expect(s.payload.update.mock.calls.at(-1)![0]).toMatchObject({
      collection: 'parking_snapshots',
      id: 99,
      data: { judge_status: 'skipped', judge_error: 'same_window' },
    });
  });

  it('枠の更新は「未設定か今回より小さい」を条件にする', async () => {
    const s = setup();
    await run(s);
    const sql = s.payload.db.pool.query.mock.calls[0][0] as string;
    expect(sql).toContain('last_judged_window is null or last_judged_window < $1');
    expect(sql).toContain('where id = $2');
  });

  it('古い画像の削除や判定の登録に失敗しても記録だけで終える', async () => {
    const a = setup();
    a.payload.delete.mockRejectedValue(new Error('boom'));
    await run(a);
    expect(a.payload.logger.warn).toHaveBeenCalled();
    expect(a.payload.jobs.queue).toHaveBeenCalled();
    const b = setup();
    b.payload.jobs.queue.mockRejectedValue(new Error('boom'));
    await run(b);
    expect(b.payload.logger.warn).toHaveBeenCalled();
  });

  it('保存に失敗したら例外にして、後続を行わない', async () => {
    const s = setup();
    s.payload.create.mockRejectedValue(new Error('boom'));
    await expect(run(s)).rejects.toThrow('boom');
    expect(s.payload.update).not.toHaveBeenCalled();
    expect(s.payload.jobs.queue).not.toHaveBeenCalled();
  });
});
