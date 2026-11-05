import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTrialState, getTrial, reloadTrial, startTrial, stopTrial, subscribeTrial } from './useSignageTrial';

const run = (start_at: string | null, anchored_at: string | null = null) => ({ start_at, anchored_at });
const ok = (trial_run: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trial_run, result: { trial_run } }) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('subscribeTrial / reloadTrial', () => {
  it('購読すると試験運転の値を読み込み、購読者へ知らせる', async () => {
    vi.stubGlobal('fetch', ok(run('2026-11-14T10:55:00.000Z', '2026-11-02T06:00:00.000Z')));
    const listener = vi.fn();
    const off = subscribeTrial(listener);
    await vi.waitFor(() => expect(getTrial()).toEqual(run('2026-11-14T10:55:00.000Z', '2026-11-02T06:00:00.000Z')));
    expect(listener).toHaveBeenCalled();
    off();
  });

  it('未設定(null)の値は停止中として扱う', async () => {
    vi.stubGlobal('fetch', ok(null));
    await reloadTrial();
    expect(getTrial()).toEqual(run(null, null));
  });

  it('読み込みに失敗したら直前の状態を保つ', async () => {
    vi.stubGlobal('fetch', ok(run('2026-11-14T01:55:00.000Z', '2026-11-02T06:00:00.000Z')));
    await reloadTrial();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    await reloadTrial();
    expect(getTrial()?.start_at).toBe('2026-11-14T01:55:00.000Z');
  });
});

describe('startTrial / stopTrial', () => {
  it('開始は trial_run.start_at だけを送り、保存結果を反映する', async () => {
    const f = ok(run('2026-11-14T01:55:00.000Z', '2026-11-02T06:00:00.000Z'));
    vi.stubGlobal('fetch', f);
    await startTrial('2026-11-14T10:55:00+09:00');
    const [, init] = f.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ trial_run: { start_at: '2026-11-14T10:55:00+09:00' } });
    expect(getTrial()).toEqual(run('2026-11-14T01:55:00.000Z', '2026-11-02T06:00:00.000Z'));
  });

  it('終了は start_at に null を送る', async () => {
    const f = ok(run(null, null));
    vi.stubGlobal('fetch', f);
    await stopTrial();
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ trial_run: { start_at: null } });
    expect(getTrial()).toEqual(run(null, null));
  });

  it('保存中は保存中になり、保存中の再操作は無視する', async () => {
    const f = ok(run(null, null));
    vi.stubGlobal('fetch', f);
    const p = stopTrial();
    expect(getTrialState().saving).toBe(true);
    await startTrial('2026-11-14T10:55:00+09:00');
    await p;
    expect(f).toHaveBeenCalledTimes(1);
    expect(getTrialState().saving).toBe(false);
  });

  it('失敗すると失敗を状態に持ち、保存前の値を保つ。再操作で失敗は消える', async () => {
    vi.stubGlobal('fetch', ok(run('2026-11-14T01:55:00.000Z', '2026-11-02T06:00:00.000Z')));
    await reloadTrial();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    await stopTrial();
    expect(getTrialState()).toEqual({ saving: false, failed: true });
    expect(getTrial()?.start_at).toBe('2026-11-14T01:55:00.000Z');

    vi.stubGlobal('fetch', ok(run(null, null)));
    await stopTrial();
    expect(getTrialState().failed).toBe(false);
  });
});
