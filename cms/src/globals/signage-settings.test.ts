import { describe, expect, it, vi } from 'vitest';

const { notify } = vi.hoisted(() => ({ notify: vi.fn(() => async () => {}) }));
vi.mock('../lib/signage-notify', () => ({ signageNotifyGlobalHook: notify }));

import { SignageSettings } from './signage-settings';

type F = { name: string; type: string; relationTo?: string; hasMany?: boolean; required?: boolean; filterOptions?: unknown; admin?: { description?: string } };

describe('SignageSettings', () => {
  const fields = SignageSettings.fields as F[];
  const pinned = fields.find((x) => x.name === 'pinned_slide')!;

  it('slug とラベル', () => {
    expect(SignageSettings.slug).toBe('signage_settings');
    expect(SignageSettings.label).toBe('サイネージ設定');
  });

  it('ナビには出さず、操作はスライド画面で行う', () => {
    expect(SignageSettings.admin?.hidden).toBe(true);
  });

  it('試験運転は開始日時と管理画面で非表示の起点を持つ', () => {
    const trial = fields.find((x) => x.name === 'trial_run') as unknown as { type: string; fields: { name: string; type: string; admin?: { hidden?: boolean; readOnly?: boolean } }[] };
    expect(trial.type).toBe('group');
    expect(trial.fields.map((f) => [f.name, f.type])).toEqual([['start_at', 'date'], ['anchored_at', 'date']]);
    expect(trial.fields[1].admin?.hidden).toBe(true);
  });

  it('開始日時の送信有無を補完前に context へ残す', () => {
    const trial = fields.find((x) => x.name === 'trial_run') as unknown as { hooks: { beforeValidate: ((a: unknown) => unknown)[] } };
    const req = { context: {} as Record<string, unknown> };
    trial.hooks.beforeValidate[0]({ siblingData: { trial_run: { start_at: null } }, req });
    expect(req.context.trialStartSent).toBeNull();
    trial.hooks.beforeValidate[0]({ siblingData: {}, req });
    expect(req.context.trialStartSent).toBeUndefined();
  });

  it('保存後の通知は固定とスナップショットの両方', () => {
    expect(notify).toHaveBeenCalledWith(['pin', 'snapshot']);
    expect(SignageSettings.hooks?.afterChange).toHaveLength(1);
  });

  describe('beforeChange', () => {
    const hook = SignageSettings.hooks!.beforeChange![0] as (a: unknown) => Promise<{ trial_run: unknown }>;
    const run = (sent: string | null | undefined, originalDoc: unknown, days: string[] = ['2026-11-07T00:00:00.000Z']) =>
      hook({
        data: { trial_run: { start_at: 'filled-from-doc' } },
        originalDoc,
        req: { context: { trialStartSent: sent }, payload: { findGlobal: vi.fn().mockResolvedValue({ event_days: days.map((d) => ({ start_at: d })) }) } },
      });

    it('送られていなければ前の値を保持し検証しない', async () => {
      const prev = { start_at: '2020-01-01T00:00:00.000Z', anchored_at: '2020-01-01T00:00:00.000Z' };
      expect((await run(undefined, { trial_run: prev })).trial_run).toEqual(prev);
    });

    it('null で終了', async () => {
      const prev = { start_at: '2026-11-07T00:00:00.000Z', anchored_at: '2026-11-01T00:00:00.000Z' };
      expect((await run(null, { trial_run: prev })).trial_run).toEqual({ start_at: null, anchored_at: null });
    });

    it('日時で送られると起点を刻む', async () => {
      const r = await run('2026-11-07T01:00:00.000Z', null);
      expect((r.trial_run as { start_at: string; anchored_at: string }).anchored_at).toMatch(/\.000Z$/);
    });

    it('開催日でなければ検証エラー', async () => {
      await expect(run('2026-11-09T01:00:00.000Z', null)).rejects.toThrow();
    });
  });

  it('固定表示するスライドは任意の単一参照で、表示対象のスライドだけ選べる', async () => {
    expect(fields).toHaveLength(2);
    expect(pinned.type).toBe('relationship');
    expect(pinned.relationTo).toBe('signage_slides');
    expect(pinned.hasMany).toBeFalsy();
    expect(pinned.required).toBeFalsy();
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ docs: [{ id: 10, is_all: true, visible: false, slides: [] }, { id: 11, visible: true, slides: [2] }] });
    const opts = pinned.filterOptions as (a: { req: unknown }) => Promise<unknown>;
    expect(await opts({ req: { payload: { find } } })).toEqual({ id: { in: [2] } });
    expect(pinned.admin?.description).toBe(
      '選んだスライドだけを全画面に表示し続けます。空にすると通常の巡回に戻ります。',
    );
  });
});
