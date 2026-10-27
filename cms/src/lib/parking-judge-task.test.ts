import { describe, expect, it, vi } from 'vitest';

import type { JudgeOutcome } from './parking-judge';
import { runJudgeParkingSnapshot } from './parking-judge-task';

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const jpegB64 = Buffer.from('jpeg').toString('base64');

function setup(opts: {
  snapshot?: Record<string, unknown> | null;
  reloaded?: Record<string, unknown> | null;
  camera?: Record<string, unknown>;
}) {
  const snapshot =
    opts.snapshot === null
      ? null
      : { id: 5, camera: 3, lot: 11, exposure: 1, captured_at: '2026-10-10T01:00:00.000Z', ...opts.snapshot };
  const camera = { id: 3, exposure_basis: null, ...opts.camera };
  let snapshotReads = 0;
  const payload = {
    findByID: vi.fn(async (args: Args) => {
      if (args.collection === 'parking_cameras') return camera;
      snapshotReads += 1;
      // 1回目が判定前、2回目以降は判定後の引き直し
      return snapshotReads === 1 || opts.reloaded === undefined ? snapshot : opts.reloaded;
    }),
    find: vi.fn(async () => ({ docs: [{ id: 21 }] })),
    update: vi.fn().mockResolvedValue({}),
    logger: { warn: vi.fn() },
  };
  return { payload };
}

const judged = (over: Partial<Extract<JudgeOutcome, { kind: 'judged' }>> = {}): JudgeOutcome => ({
  kind: 'judged',
  model: 'gemma-4-26b-a4b-it',
  congestion: 'crowded',
  quality: 'ok',
  ...over,
});

async function run(s: ReturnType<typeof setup>, outcome: JudgeOutcome, configured = true) {
  const judge = vi.fn().mockResolvedValue(outcome);
  await runJudgeParkingSnapshot({
    payload: s.payload,
    snapshotId: 5,
    image: jpegB64,
    judge: configured ? judge : null,
    now: () => new Date('2026-10-10T01:05:00Z'),
  });
  return { judge };
}

const updates = (s: ReturnType<typeof setup>, collection: string) =>
  s.payload.update.mock.calls.filter((c) => (c[0] as Args).collection === collection).map((c) => c[0] as Args);

describe('judgeParkingSnapshot', () => {
  it('画像が無ければ何もしない', async () => {
    const s = setup({ snapshot: null });
    const { judge } = await run(s, judged());
    expect(judge).not.toHaveBeenCalled();
    expect(s.payload.update).not.toHaveBeenCalled();
  });

  it('割り当て先があれば混雑と写り具合、無ければ写り具合だけを判定させる', async () => {
    const a = setup({});
    expect((await run(a, judged())).judge.mock.calls[0][1]).toBe('congestion_and_quality');
    const b = setup({ snapshot: { lot: null } });
    expect((await run(b, judged({ congestion: null }))).judge.mock.calls[0][1]).toBe('quality_only');
  });

  it('成功は画像に記録し、空き状況を判定結果で更新する', async () => {
    const s = setup({});
    await run(s, judged());
    expect(updates(s, 'parking_snapshots')[0]).toMatchObject({
      id: 5,
      data: {
        judge_status: 'succeeded',
        judge_error: null,
        congestion: 'crowded',
        image_quality: 'ok',
        judge_model: 'gemma-4-26b-a4b-it',
        judged_at: '2026-10-10T01:05:00.000Z',
      },
    });
    expect(updates(s, 'parking_statuses')).toEqual([
      expect.objectContaining({ id: 21, data: { status: 'crowded' }, overrideAccess: true }),
    ]);
  });

  it('割り当て先が無い画像では空き状況を更新しない', async () => {
    const s = setup({ snapshot: { lot: null } });
    await run(s, judged({ congestion: null }));
    expect(updates(s, 'parking_statuses')).toEqual([]);
  });

  it('判定中に割り当てが外れた画像では空き状況を更新しない', async () => {
    const s = setup({ reloaded: { id: 5, lot: null } });
    await run(s, judged());
    expect(updates(s, 'parking_statuses')).toEqual([]);
    expect(updates(s, 'parking_snapshots')[0]).toMatchObject({ data: { judge_status: 'succeeded' } });
  });

  it('失敗・見送りでは空き状況を変えず、理由を記録して warn に出す', async () => {
    const cases: [JudgeOutcome, string, string][] = [
      [{ kind: 'failed', detail: 'gemma-4-26b-a4b-it 500x3' }, 'failed', 'api_error: gemma-4-26b-a4b-it 500x3'],
      [{ kind: 'rate_limited' }, 'skipped', 'rate_limited'],
      [judged({ congestion: 'unknown' }), 'failed', 'unknown'],
    ];
    for (const [outcome, status, error] of cases) {
      const s = setup({});
      await run(s, outcome);
      expect(updates(s, 'parking_statuses')).toEqual([]);
      expect(updates(s, 'parking_snapshots')[0]).toMatchObject({ data: { judge_status: status, judge_error: error } });
      expect(s.payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining('camera=3'));
      expect(s.payload.logger.warn).toHaveBeenCalledWith(expect.stringContaining('snapshot=5'));
    }
  });

  it('打ち切りは何も記録しない', async () => {
    const s = setup({});
    await run(s, { kind: 'superseded' });
    expect(s.payload.update).not.toHaveBeenCalled();
  });

  it('GEMINI_API_KEY が無ければ not_configured を記録し、Gemini を呼ばない', async () => {
    const s = setup({});
    const { judge } = await run(s, judged(), false);
    expect(judge).not.toHaveBeenCalled();
    expect(updates(s, 'parking_snapshots')[0]).toMatchObject({
      data: { judge_status: 'failed', judge_error: 'not_configured' },
    });
    expect(updates(s, 'parking_statuses')).toEqual([]);
  });

  it('写り具合が有効で撮影が起点より新しければ露出の起点を更新する', async () => {
    const s = setup({ camera: { exposure_basis: { captured_at: '2026-10-10T00:55:00.000Z' } } });
    await run(s, judged({ quality: 'too_dark' }));
    expect(updates(s, 'parking_cameras')).toEqual([
      expect.objectContaining({
        id: 3,
        data: { exposure_basis: { quality: 'too_dark', exposure: 1, captured_at: '2026-10-10T01:00:00.000Z' } },
      }),
    ]);
  });

  it('起点より古い画像・写り具合が無効な画像では起点を更新しない', async () => {
    const old = setup({ camera: { exposure_basis: { captured_at: '2026-10-10T01:10:00.000Z' } } });
    await run(old, judged());
    expect(updates(old, 'parking_cameras')).toEqual([]);
    const invalid = setup({});
    await run(invalid, judged({ quality: null }));
    expect(updates(invalid, 'parking_cameras')).toEqual([]);
  });

  it('混雑が unknown でも写り具合が有効なら起点は更新する', async () => {
    const s = setup({});
    await run(s, judged({ congestion: 'unknown', quality: 'too_bright' }));
    expect(updates(s, 'parking_cameras')).toHaveLength(1);
  });

  it('混雑は判定できたが写り具合が不正なら invalid_quality を添えて空き状況は更新する', async () => {
    const s = setup({});
    await run(s, judged({ quality: null }));
    expect(updates(s, 'parking_snapshots')[0]).toMatchObject({
      data: { judge_status: 'succeeded', judge_error: 'invalid_quality', image_quality: null },
    });
    expect(updates(s, 'parking_statuses')).toHaveLength(1);
  });

  it('成功はログに出さない', async () => {
    const s = setup({});
    await run(s, judged());
    expect(s.payload.logger.warn).not.toHaveBeenCalled();
  });
});
