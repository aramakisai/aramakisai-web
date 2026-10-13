import type {
  SignageQuakeObservation,
  SignageQuakePayload,
  SignageQuakeStage,
} from '../../src/lib/signage-quake';
import type { ChannelName } from './relay-config';
import {
  parseJstTime,
  type EewReport,
  type EqlistReport,
  type ObservationReport,
  type QuakeReport,
} from './upstream';

export interface EewKey {
  readonly eventId: string;
  readonly serial: number;
  readonly cancelled: boolean;
}

export type QuakeNotice =
  | {
      readonly kind: 'eew';
      readonly op: 'post' | 'edit';
      readonly report: EewReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'observation';
      readonly report: ObservationReport;
      readonly receivedAt: number;
    }
  | {
      readonly kind: 'stage';
      readonly payload: SignageQuakePayload;
      readonly at: number;
    }
  | {
      readonly kind: 'dismissed';
      readonly by: string;
      readonly training: boolean;
      readonly at: number;
    }
  | {
      readonly kind: 'channel';
      readonly channel: ChannelName;
      readonly receiving: boolean;
      readonly lastReceivedAt: number | null;
      readonly at: number;
    };

export const EEW_FRESH_MS = 120_000;
export const OBSERVATION_FRESH_MS = 600_000;
export const EQLIST_FRESH_MS = 1_200_000;
export const EEW_RECORD_LIMIT = 50;

/** 地震ごとに、最も新しい報と、その報のDiscordの投稿を1件だけ持つ */
export interface EewRecord extends EewKey {
  readonly source: 'p2p' | 'wolfx';
  /** 群馬県を含む警報(または試験モードの報)を投稿した地震。続報・取消の投稿の可否 */
  readonly notify: boolean;
  /** この報の投稿のメッセージID。未投稿・投稿の失敗は null */
  readonly discordMessageId: string | null;
}

export type Precedence = 'new' | 'replace' | 'drop';

/** 選別。test(試験モードの系統)の報は鮮度を問わない。群馬県の判定は processReport で行う */
export function acceptReport(
  report: QuakeReport,
  now: number,
  test: boolean,
): boolean {
  switch (report.kind) {
    case 'eew':
      return (
        (report.warning || report.cancelled) &&
        (test || now - report.issuedAt <= EEW_FRESH_MS)
      );
    case 'observation':
      return (
        report.hasStations &&
        (test || now - report.issuedAt <= OBSERVATION_FRESH_MS)
      );
    case 'eqlist':
      return test || now - report.originTime <= EQLIST_FRESH_MS;
  }
}

/** 順位は(続報番号, 取消か)の辞書順。続報番号が新しい報は系統に依らず優先する */
export function eewPrecedence(
  record: EewRecord | undefined,
  report: EewReport,
): Precedence {
  if (!record) return 'new';
  const diff =
    report.serial - record.serial ||
    Number(report.cancelled) - Number(record.cancelled);
  if (diff > 0) return 'new';
  if (diff < 0) return 'drop';
  return record.source === 'wolfx' && report.source === 'p2p'
    ? 'replace'
    : 'drop';
}

/** 同じ地震の記録は置き換え、末尾が最新。上限を超えたら古いものから捨てる */
export function putRecord(
  records: readonly EewRecord[],
  record: EewRecord,
): readonly EewRecord[] {
  return [...records.filter((r) => r.eventId !== record.eventId), record].slice(
    -EEW_RECORD_LIMIT,
  );
}

export const MATCH_WINDOW_MS = 120_000;
/** 震度5強 */
export const THRESHOLD_SCALE = 50;
export const SEEN_OBSERVATION_LIMIT = 200;
export const DISMISSED_LIMIT = 20;
const ALERT_EVENT_LIMIT = 10;

export interface AlertEvent {
  /** 警報を受けていない地震はnull */
  readonly eventId: string | null;
  readonly originTime: number;
}

export interface ActiveAlert {
  readonly stage: SignageQuakeStage;
  readonly training: boolean;
  /** 段階1・取消の根拠の警報の情報源 */
  readonly source: 'p2p' | 'wolfx';
  readonly events: readonly AlertEvent[];
  readonly reachedEvacuate: boolean;
  readonly observation: SignageQuakeObservation | null;
  readonly startedAt: number;
  readonly updatedAt: number;
}

export interface DismissedEvent {
  readonly event: AlertEvent;
  readonly reachedEvacuate: boolean;
}

export interface RelayState {
  readonly alert: ActiveAlert | null;
  readonly dismissed: readonly DismissedEvent[];
  readonly eew: readonly EewRecord[];
  /** 投稿したP2Pの地震情報のID */
  readonly seenObservation: readonly string[];
  /** 最後にpublishに成功したpayloadのJSON。nullは未送信 */
  readonly published: string | null;
}

export interface Outcome {
  readonly state: RelayState;
  readonly notices: readonly QuakeNotice[];
}

export function emptyRelayState(): RelayState {
  return {
    alert: null,
    dismissed: [],
    eew: [],
    seenObservation: [],
    published: null,
  };
}

/** 表示中は有効期限を持たない前提の、端末へ配るpayload */
export function toPayload(state: RelayState): SignageQuakePayload {
  const a = state.alert;
  if (!a) return { active: false };
  const showsObservation = a.stage === 'calm' || a.stage === 'evacuate';
  return {
    active: true,
    stage: a.stage,
    training: a.training,
    source: a.source,
    startedAt: new Date(a.startedAt).toISOString(),
    updatedAt: new Date(a.updatedAt).toISOString(),
    observation: showsObservation ? a.observation : null,
  };
}

const near = (a: number, b: number) => Math.abs(a - b) <= MATCH_WINDOW_MS;

/**
 * 本物の表示中に訓練の報は使わない。訓練の表示中の本物の報は、表示が無いときと同じ規則で
 * 判定し、表示が始まらなければ訓練の表示を保つ
 */
function withTrainingRule(
  cur: ActiveAlert | null,
  training: boolean,
  step: (base: ActiveAlert | null) => ActiveAlert | null,
): ActiveAlert | null {
  if (cur && !cur.training && training) return cur;
  const base = cur?.training && !training ? null : cur;
  return step(base) ?? cur;
}

function stepEew(
  state: RelayState,
  report: EewReport,
  prec: 'new' | 'replace',
  eew: readonly EewRecord[],
  now: number,
  test: boolean,
): ActiveAlert | null {
  return withTrainingRule(state.alert, report.training, (base) => {
    const shown = base?.events.some((e) => e.eventId === report.eventId);
    if (prec === 'replace')
      return base && shown && base.source !== 'p2p'
        ? { ...base, source: 'p2p', updatedAt: now }
        : base;
    if (report.cancelled) {
      if (!base || !shown || base.stage === 'evacuate') return base;
      if (base.stage === 'cancelled') return base;
      // 2つの地震を表示中に片方の取消で「取り消された」と出さない
      const allCancelled = base.events.every(
        (e) => eew.find((r) => r.eventId === e.eventId)?.cancelled === true,
      );
      return allCancelled
        ? {
            ...base,
            stage: 'cancelled',
            source: report.source,
            observation: null,
            updatedAt: now,
          }
        : base;
    }
    if (!(report.gunma || test)) return base;
    if (state.dismissed.some((d) => d.event.eventId === report.eventId))
      return base;
    if (shown) return base;
    const event = {
      eventId: report.eventId,
      originTime: report.originTime ?? 0,
    };
    if (base?.stage === 'warning')
      return {
        ...base,
        events: [...base.events, event].slice(-ALERT_EVENT_LIMIT),
      };
    return {
      stage: 'warning',
      training: report.training,
      source: report.source,
      events: [event],
      reachedEvacuate: false,
      observation: null,
      startedAt: base?.startedAt ?? now,
      updatedAt: now,
    };
  });
}

function stepObservation(
  state: RelayState,
  report: ObservationReport,
  now: number,
  newEvent: AlertEvent,
): ActiveAlert | null {
  const scale = report.maebashiMaxScale;
  const hi = scale !== null && scale >= THRESHOLD_SCALE;
  return withTrainingRule(state.alert, report.training, (base) => {
    const matched = base?.events.some((e) =>
      near(e.originTime, report.originTime),
    );
    if (hi)
      return {
        stage: 'evacuate',
        training: report.training,
        source: base?.source ?? 'p2p',
        reachedEvacuate: true,
        observation: report.observation,
        startedAt: base?.startedAt ?? now,
        updatedAt: now,
        events:
          matched && base
            ? base.events
            : [...(base?.events ?? []), newEvent].slice(-ALERT_EVENT_LIMIT),
      };
    if (!base || !matched) return base;
    // 46だけの地震情報は段階を変えない。受信値と情報源の置き換えだけ行う
    if (base.stage === 'calm')
      return { ...base, observation: report.observation, updatedAt: now };
    if (base.stage === 'warning' && !report.maebashiEstimated)
      return {
        ...base,
        stage: 'calm',
        observation: report.observation,
        updatedAt: now,
      };
    return base;
  });
}

function stepEqlist(
  state: RelayState,
  report: EqlistReport,
  now: number,
): ActiveAlert | null {
  return withTrainingRule(state.alert, report.training, (base) => {
    if (!base) return base;
    const shownTime = base.observation
      ? parseJstTime(base.observation.originTime)
      : null;
    if (
      base.observation?.source === 'p2p' &&
      (base.events.some((e) => e.eventId === report.eventId) ||
        (shownTime !== null && near(shownTime, report.originTime)))
    )
      return base;
    const matched = base.events.some((e) => e.eventId === report.eventId);
    return base.stage === 'warning' && matched && report.belowFiveLower
      ? {
          ...base,
          stage: 'calm',
          observation: report.observation,
          updatedAt: now,
        }
      : base;
  });
}

/** 報の選別を通ったものだけを遷移の入力にし、新しい状態と通知を返す */
export function processReport(
  state: RelayState,
  report: QuakeReport,
  now: number,
  test: boolean,
): Outcome {
  if (!acceptReport(report, now, test)) return { state, notices: [] };
  switch (report.kind) {
    case 'eew': {
      const rec = state.eew.find((r) => r.eventId === report.eventId);
      const prec = eewPrecedence(rec, report);
      if (prec === 'drop') return { state, notices: [] };
      const record: EewRecord =
        prec === 'new'
          ? {
              eventId: report.eventId,
              serial: report.serial,
              cancelled: report.cancelled,
              source: report.source,
              notify: report.gunma || test || (rec?.notify ?? false),
              discordMessageId: null,
            }
          : { ...rec!, source: 'p2p' };
      const eew = putRecord(state.eew, record);
      return {
        state: {
          ...state,
          eew,
          alert: stepEew(state, report, prec, eew, now, test),
        },
        notices: [],
      };
    }
    case 'observation': {
      const dis = state.dismissed.find((d) =>
        near(d.event.originTime, report.originTime),
      );
      const hi =
        report.maebashiMaxScale !== null &&
        report.maebashiMaxScale >= THRESHOLD_SCALE;
      // 解除した地震は、段階3に達していなかったときに5強以上と分かった場合だけ再表示する
      if (dis && !(hi && !dis.reachedEvacuate)) return { state, notices: [] };
      const event = dis?.event ?? {
        eventId: null,
        originTime: report.originTime,
      };
      return {
        state: {
          ...state,
          dismissed: dis
            ? state.dismissed.filter((d) => d !== dis)
            : state.dismissed,
          alert: stepObservation(state, report, now, event),
        },
        notices: [],
      };
    }
    case 'eqlist':
      return {
        state: { ...state, alert: stepEqlist(state, report, now) },
        notices: [],
      };
  }
}

/** byは解除した実行委員(CMSのユーザーのメールアドレス)。表示中でなければ何もしない */
export function applyDismiss(
  state: RelayState,
  now: number,
  by: string,
): Outcome {
  void by;
  const a = state.alert;
  if (!a) return { state, notices: [] };
  const dismissed = [
    ...state.dismissed,
    ...a.events.map((event) => ({ event, reachedEvacuate: a.reachedEvacuate })),
  ].slice(-DISMISSED_LIMIT);
  void now;
  return { state: { ...state, alert: null, dismissed }, notices: [] };
}
