import { describe, expect, it } from 'vitest';
import type {
  SignageBroadcast,
  SignagePinPayload,
} from '../../src/lib/signage-channel';
import {
  CONFIRM_DELAY_MS,
  NOTIFY_DELAY_MS,
  SAFETY_DELAY_MS,
  applyAlarm,
  applyPublish,
  effectiveTargets,
  emptyState,
  planConnect,
  planNotify,
  type HubState,
} from './hub-core';

const NOW = Date.parse('2026-10-12T00:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const pinPayload = (
  ids: number[],
  slideId: number | null = null,
): SignagePinPayload => ({
  slide:
    slideId === null ? null : ({ id: slideId } as SignagePinPayload['slide']),
  visibleSlideIds: ids,
});

const pinBroadcast = (
  payload: SignagePinPayload,
): Extract<SignageBroadcast, { feature: 'pin' }> => ({
  kind: 'broadcast',
  feature: 'pin',
  payload,
  expiresAt: null,
  sentAt: iso(NOW - 1000),
});

const snapshotBroadcast = (
  version: number,
): Extract<SignageBroadcast, { feature: 'snapshot' }> => ({
  kind: 'broadcast',
  feature: 'snapshot',
  payload: { version },
  expiresAt: null,
  sentAt: iso(NOW - 1000),
});

const state = (patch: Partial<HubState> = {}): HubState => ({
  ...emptyState(),
  ...patch,
});

describe('planNotify', () => {
  it('alarm が無ければ 500ms 後に設定し、targets を保留に足す', () => {
    const r = planNotify(emptyState(), ['pin'], null, NOW);
    expect(r.alarmAt).toBe(NOW + NOTIFY_DELAY_MS);
    expect(r.state.pendingTargets).toEqual(['pin']);
  });

  it('既に 500ms 後より早い alarm があれば延ばさない', () => {
    expect(planNotify(emptyState(), ['pin'], NOW + 100, NOW).alarmAt).toBe(
      NOW + 100,
    );
  });

  it('500ms 後より遅い alarm(確かめや保険)は 500ms 後に前倒しする', () => {
    expect(
      planNotify(emptyState(), ['pin'], NOW + CONFIRM_DELAY_MS, NOW).alarmAt,
    ).toBe(NOW + NOTIFY_DELAY_MS);
    expect(
      planNotify(emptyState(), ['pin'], NOW + SAFETY_DELAY_MS, NOW).alarmAt,
    ).toBe(NOW + NOTIFY_DELAY_MS);
  });

  it('保留の targets は重複なく足す', () => {
    const r = planNotify(
      state({ pendingTargets: ['pin'] }),
      ['pin', 'snapshot'],
      null,
      NOW,
    );
    expect(r.state.pendingTargets).toEqual(['pin', 'snapshot']);
  });

  it('確かめ待ちの最中の通知は確かめ待ちを解いて取り直しからやり直す', () => {
    const r = planNotify(
      state({ pendingTargets: ['pin'], confirmDue: true }),
      ['snapshot'],
      NOW + CONFIRM_DELAY_MS,
      NOW,
    );
    expect(r.state.confirmDue).toBe(false);
    expect(r.state.pendingTargets).toEqual(['pin', 'snapshot']);
  });
});

describe('effectiveTargets', () => {
  it('保留があればそれを、無ければ保険として pin を取る', () => {
    expect(effectiveTargets(state({ pendingTargets: ['snapshot'] }))).toEqual([
      'snapshot',
    ]);
    expect(effectiveTargets(emptyState())).toEqual(['pin']);
  });
});

describe('applyAlarm: 通知の取り直し', () => {
  const pinned = pinPayload([1, 2], 1);

  it('保持と違う pin は配って保持を置き換える', () => {
    const r = applyAlarm(state({ pendingTargets: ['pin'] }), {
      now: NOW,
      pin: pinned,
      connections: 2,
    });
    expect(r.broadcasts).toEqual([
      {
        kind: 'broadcast',
        feature: 'pin',
        payload: pinned,
        expiresAt: null,
        sentAt: iso(NOW),
      },
    ]);
    expect(r.state.retained.pin?.payload).toEqual(pinned);
  });

  it('pin の応答が保持と変わらなければ配らない', () => {
    const retained = { pin: pinBroadcast(pinned) };
    const r = applyAlarm(state({ retained, pendingTargets: ['pin'] }), {
      now: NOW,
      pin: structuredClone(pinned),
      connections: 2,
    });
    expect(r.broadcasts).toEqual([]);
    expect(r.state.retained.pin).toBe(retained.pin);
  });

  it('visibleSlideIds だけ違っても配る', () => {
    const retained = { pin: pinBroadcast(pinned) };
    const r = applyAlarm(state({ retained, pendingTargets: ['pin'] }), {
      now: NOW,
      pin: pinPayload([1], 1),
      connections: 2,
    });
    expect(r.broadcasts).toHaveLength(1);
  });

  it('targets に pin が無ければ pin は配らない(取り直しにも使わない)', () => {
    const r = applyAlarm(state({ pendingTargets: ['snapshot'] }), {
      now: NOW,
      pin: pinned,
      connections: 2,
    });
    expect(r.broadcasts.map((b) => b.feature)).toEqual(['snapshot']);
  });

  it('snapshot を含めば版を now で配る', () => {
    const r = applyAlarm(state({ pendingTargets: ['snapshot'] }), {
      now: NOW,
      pin: null,
      connections: 2,
    });
    expect(r.broadcasts[0]).toMatchObject({
      feature: 'snapshot',
      payload: { version: NOW },
    });
    expect(r.state.retained.snapshot?.payload.version).toBe(NOW);
  });

  it('版は保持より必ず大きくなる(時計が戻っても単調増加)', () => {
    const retained = { snapshot: snapshotBroadcast(NOW + 10_000) };
    const r = applyAlarm(state({ retained, pendingTargets: ['snapshot'] }), {
      now: NOW,
      pin: null,
      connections: 1,
    });
    expect(r.state.retained.snapshot?.payload.version).toBe(NOW + 10_001);
  });

  it('pin と snapshot を同時に含めば両方配る', () => {
    const r = applyAlarm(state({ pendingTargets: ['pin', 'snapshot'] }), {
      now: NOW,
      pin: pinned,
      connections: 1,
    });
    expect(r.broadcasts.map((b) => b.feature).sort()).toEqual([
      'pin',
      'snapshot',
    ]);
  });
});

describe('applyAlarm: 次の alarm', () => {
  it('通知の直後は 5 秒後に確かめを 1 回設定し、保留と確かめ待ちを残す', () => {
    const r = applyAlarm(state({ pendingTargets: ['pin'] }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 3,
    });
    expect(r.alarmAt).toBe(NOW + CONFIRM_DELAY_MS);
    expect(r.state.pendingTargets).toEqual(['pin']);
    expect(r.state.confirmDue).toBe(true);
  });

  it('確かめの後は保留を空にして、接続があれば 60 秒後の保険', () => {
    const r = applyAlarm(state({ pendingTargets: ['pin'], confirmDue: true }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 3,
    });
    expect(r.alarmAt).toBe(NOW + SAFETY_DELAY_MS);
    expect(r.state.pendingTargets).toEqual([]);
    expect(r.state.confirmDue).toBe(false);
  });

  it('確かめの後に接続が無ければ alarm を設定しない', () => {
    const r = applyAlarm(state({ pendingTargets: ['pin'], confirmDue: true }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 0,
    });
    expect(r.alarmAt).toBeNull();
  });

  it('保険の alarm(保留なし)は pin を取り直し、接続があれば次の保険を設定する', () => {
    const r = applyAlarm(emptyState(), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 1,
    });
    expect(r.broadcasts.map((b) => b.feature)).toEqual(['pin']);
    expect(r.alarmAt).toBe(NOW + SAFETY_DELAY_MS);
    expect(r.state.confirmDue).toBe(false);
  });

  it('保険の alarm でも接続が無ければ設定しない', () => {
    expect(
      applyAlarm(emptyState(), {
        now: NOW,
        pin: pinPayload([1]),
        connections: 0,
      }).alarmAt,
    ).toBeNull();
  });

  it('保険では版を進めない', () => {
    const retained = { snapshot: snapshotBroadcast(5) };
    const r = applyAlarm(state({ retained }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 1,
    });
    expect(r.state.retained.snapshot).toBe(retained.snapshot);
  });

  it('確かめのalarmで snapshot を含む束なら版がもう一度進む', () => {
    const first = applyAlarm(state({ pendingTargets: ['pin', 'snapshot'] }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 1,
    });
    const v1 = first.state.retained.snapshot?.payload.version ?? 0;
    const second = applyAlarm(first.state, {
      now: NOW + CONFIRM_DELAY_MS,
      pin: pinPayload([1]),
      connections: 1,
    });
    expect(second.state.retained.snapshot?.payload.version).toBeGreaterThan(v1);
    expect(second.broadcasts.map((b) => b.feature)).toEqual(['snapshot']);
  });

  it('確かめで pin が変わっていなければ pin は配らない', () => {
    const first = applyAlarm(state({ pendingTargets: ['pin'] }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 1,
    });
    const second = applyAlarm(first.state, {
      now: NOW + CONFIRM_DELAY_MS,
      pin: pinPayload([1]),
      connections: 1,
    });
    expect(second.broadcasts).toEqual([]);
  });

  it('確かめで pin が変わっていれば配る(commit の遅れの補正)', () => {
    const first = applyAlarm(state({ pendingTargets: ['pin'] }), {
      now: NOW,
      pin: pinPayload([1]),
      connections: 1,
    });
    const second = applyAlarm(first.state, {
      now: NOW + CONFIRM_DELAY_MS,
      pin: pinPayload([1, 2]),
      connections: 1,
    });
    expect(second.broadcasts.map((b) => b.feature)).toEqual(['pin']);
  });
});

describe('applyAlarm: 取り直しの失敗', () => {
  it('保持と保留を残し、60 秒後まで取りに行かない', () => {
    const before = state({
      retained: { pin: pinBroadcast(pinPayload([1])) },
      pendingTargets: ['pin', 'snapshot'],
    });
    const r = applyAlarm(before, { now: NOW, pin: 'failed', connections: 2 });
    expect(r.broadcasts).toEqual([]);
    expect(r.state).toEqual(before);
    expect(r.alarmAt).toBe(NOW + SAFETY_DELAY_MS);
  });

  it('確かめ待ちの失敗でも確かめ待ちを残す', () => {
    const before = state({ pendingTargets: ['pin'], confirmDue: true });
    const r = applyAlarm(before, { now: NOW, pin: 'failed', connections: 2 });
    expect(r.state.confirmDue).toBe(true);
    expect(r.alarmAt).toBe(NOW + SAFETY_DELAY_MS);
  });

  it('pin が要らない束(snapshot のみ)は pin の失敗に影響されない', () => {
    const r = applyAlarm(state({ pendingTargets: ['snapshot'] }), {
      now: NOW,
      pin: 'failed',
      connections: 1,
    });
    expect(r.broadcasts.map((b) => b.feature)).toEqual(['snapshot']);
  });
});

describe('applyPublish', () => {
  const feature = 'quake' as const;
  // 型に無い機能を他機能が足した状況を再現する
  const input = (expiresAt: string | null, n = 1) =>
    ({ feature, payload: { n }, expiresAt }) as unknown as Parameters<
      typeof applyPublish
    >[1];

  it('sentAt を付けて配り、機能ごとに保持を置き換える', () => {
    const a = applyPublish(emptyState(), input(null, 1), NOW);
    expect(a.broadcast).toMatchObject({
      kind: 'broadcast',
      feature,
      sentAt: iso(NOW),
      payload: { n: 1 },
    });
    const b = applyPublish(a.state, input(null, 2), NOW + 1);
    expect(Object.keys(b.state.retained)).toEqual([feature]);
    expect(
      (b.state.retained as Record<string, SignageBroadcast>)[feature]?.payload,
    ).toEqual({ n: 2 });
  });

  it('期限内なら保持して配る', () => {
    const r = applyPublish(emptyState(), input(iso(NOW + 1000)), NOW);
    expect(r.broadcast).not.toBeNull();
  });

  it('既に期限切れなら送らず保持もしない', () => {
    const r = applyPublish(emptyState(), input(iso(NOW)), NOW);
    expect(r.broadcast).toBeNull();
    expect(r.state.retained).toEqual({});
  });

  it('期限切れの publish は同じ機能の既存の保持を消さない', () => {
    const a = applyPublish(emptyState(), input(null, 1), NOW);
    const b = applyPublish(a.state, input(iso(NOW - 1), 2), NOW);
    expect(
      (b.state.retained as Record<string, SignageBroadcast>)[feature]?.payload,
    ).toEqual({ n: 1 });
  });

  it('他の機能の保持には触れない', () => {
    const base = state({ retained: { pin: pinBroadcast(pinPayload([1])) } });
    const r = applyPublish(base, input(null), NOW);
    expect(r.state.retained.pin).toBe(base.retained.pin);
  });
});

describe('planConnect', () => {
  it('期限内の保持を全部返す', () => {
    const pin = pinBroadcast(pinPayload([1]));
    const snap = snapshotBroadcast(3);
    const r = planConnect(state({ retained: { pin, snapshot: snap } }), NOW);
    expect(r.messages).toEqual([pin, snap]);
    expect(r.alarmAt).toBeNull();
  });

  it('期限切れは保持から捨てて送らない', () => {
    const live = snapshotBroadcast(3);
    const expired = {
      ...pinBroadcast(pinPayload([1])),
      expiresAt: iso(NOW - 1),
    };
    const r = planConnect(
      state({ retained: { pin: expired, snapshot: live } }),
      NOW,
    );
    expect(r.messages).toEqual([live]);
    expect(r.state.retained.pin).toBeUndefined();
    expect(r.state.retained.snapshot).toBe(live);
  });

  it('pin の保持が無ければ pin を保留に足して即時に取り直す', () => {
    const r = planConnect(emptyState(), NOW);
    expect(r.messages).toEqual([]);
    expect(r.state.pendingTargets).toEqual(['pin']);
    expect(r.alarmAt).toBe(NOW);
  });

  it('保持が空の接続でも、既存の保留 targets は残す', () => {
    const r = planConnect(state({ pendingTargets: ['snapshot'] }), NOW);
    expect(r.state.pendingTargets).toEqual(['snapshot', 'pin']);
  });
});
