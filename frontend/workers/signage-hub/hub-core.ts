import {
  isExpired,
  type SignageBroadcast,
  type SignageFeature,
  type SignagePinPayload,
  type SignagePublishInput,
} from '../../src/lib/signage-channel';

export type NotifyTarget = 'pin' | 'snapshot';

export const NOTIFY_DELAY_MS = 500;
export const CONFIRM_DELAY_MS = 5_000;
export const SAFETY_DELAY_MS = 60_000;

type Retained = Partial<{
  readonly [F in SignageFeature]: Extract<SignageBroadcast, { feature: F }>;
}>;

export interface HubState {
  readonly retained: Retained;
  readonly pendingTargets: readonly NotifyTarget[];
  /** 通知で取り直した後の、5 秒後の確かめを待っている */
  readonly confirmDue: boolean;
}

export const emptyState = (): HubState => ({
  retained: {},
  pendingTargets: [],
  confirmDue: false,
});

const withTargets = (
  current: readonly NotifyTarget[],
  add: readonly NotifyTarget[],
) => [
  ...current,
  ...add.filter((t, i) => !current.includes(t) && add.indexOf(t) === i),
];

/** 保存の通知。既に 500ms 後より早い alarm は延ばさない */
export function planNotify(
  state: HubState,
  targets: readonly NotifyTarget[],
  currentAlarmAt: number | null,
  now: number,
): { state: HubState; alarmAt: number } {
  const due = now + NOTIFY_DELAY_MS;
  return {
    // 確かめ待ちのまま通知が来ると、後続の alarm が確かめ扱いで保留を消してしまう
    state: {
      ...state,
      pendingTargets: withTargets(state.pendingTargets, targets),
      confirmDue: false,
    },
    alarmAt:
      currentAlarmAt !== null && currentAlarmAt < due ? currentAlarmAt : due,
  };
}

/** alarm で取り直す対象。保留が無い alarm は保険の pin の取り直し */
export function effectiveTargets(state: HubState): readonly NotifyTarget[] {
  return state.pendingTargets.length > 0 ? state.pendingTargets : ['pin'];
}

const nextVersion = (retained: Retained, now: number) =>
  Math.max((retained.snapshot?.payload.version ?? 0) + 1, now);

export interface AlarmInput {
  readonly now: number;
  /** pin の取得結果。取得しなかった・失敗したときは 'failed' か null */
  readonly pin: SignagePinPayload | 'failed' | null;
  readonly connections: number;
}

export interface AlarmResult {
  readonly state: HubState;
  readonly broadcasts: readonly SignageBroadcast[];
  /** null は alarm を設定しない */
  readonly alarmAt: number | null;
}

export function applyAlarm(state: HubState, input: AlarmInput): AlarmResult {
  const { now, connections } = input;
  const targets = effectiveTargets(state);
  const needsPin = targets.includes('pin');

  if (needsPin && (input.pin === 'failed' || input.pin === null)) {
    return {
      state,
      broadcasts: [],
      alarmAt: connections > 0 ? now + SAFETY_DELAY_MS : null,
    };
  }

  const broadcasts: SignageBroadcast[] = [];
  let retained: Retained = pruneExpired(state.retained, now);

  if (needsPin && input.pin !== 'failed' && input.pin !== null) {
    const payload = input.pin;
    if (JSON.stringify(retained.pin?.payload) !== JSON.stringify(payload)) {
      const message = {
        kind: 'broadcast',
        feature: 'pin',
        payload,
        expiresAt: null,
        sentAt: new Date(now).toISOString(),
      } as const;
      retained = { ...retained, pin: message };
      broadcasts.push(message);
    }
  }
  if (targets.includes('snapshot')) {
    const message = {
      kind: 'broadcast',
      feature: 'snapshot',
      payload: { version: nextVersion(retained, now) },
      expiresAt: null,
      sentAt: new Date(now).toISOString(),
    } as const;
    retained = { ...retained, snapshot: message };
    broadcasts.push(message);
  }

  const needsConfirm = state.pendingTargets.length > 0 && !state.confirmDue;
  return {
    state: needsConfirm
      ? { retained, pendingTargets: state.pendingTargets, confirmDue: true }
      : { retained, pendingTargets: [], confirmDue: false },
    broadcasts,
    alarmAt: needsConfirm
      ? now + CONFIRM_DELAY_MS
      : connections > 0
        ? now + SAFETY_DELAY_MS
        : null,
  };
}

/** 他機能のメッセージ。期限切れなら送らず保持にも入れない(null) */
export function applyPublish(
  state: HubState,
  input: SignagePublishInput,
  now: number,
): { state: HubState; broadcast: SignageBroadcast | null } {
  if (isExpired(input, now)) return { state, broadcast: null };
  const broadcast = {
    ...input,
    kind: 'broadcast',
    sentAt: new Date(now).toISOString(),
  } as SignageBroadcast;
  return {
    state: {
      ...state,
      retained: { ...state.retained, [input.feature]: broadcast },
    },
    broadcast,
  };
}

export function pruneExpired(retained: Retained, now: number): Retained {
  const entries = Object.entries(retained) as [
    SignageFeature,
    SignageBroadcast,
  ][];
  if (entries.every(([, m]) => !isExpired(m, now))) return retained;
  return Object.fromEntries(
    entries.filter(([, m]) => !isExpired(m, now)),
  ) as Retained;
}

/** 接続の直後。期限内の保持を送り、pin の保持が無ければすぐ取り直す */
export function planConnect(
  state: HubState,
  now: number,
): {
  state: HubState;
  messages: readonly SignageBroadcast[];
  alarmAt: number | null;
} {
  const retained = pruneExpired(state.retained, now);
  const messages = Object.values(retained) as SignageBroadcast[];
  if (retained.pin)
    return { state: { ...state, retained }, messages, alarmAt: null };
  return {
    state: {
      retained,
      pendingTargets: withTargets(state.pendingTargets, ['pin']),
      confirmDue: false,
    },
    messages,
    alarmAt: now,
  };
}
