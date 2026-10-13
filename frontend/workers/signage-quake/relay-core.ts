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

/** 遷移の前後でpayloadの表示の有無・段階・訓練が変わったときだけ段階の通知を足す */
function withStageNotice(
  prev: RelayState,
  state: RelayState,
  notices: readonly QuakeNotice[],
  now: number,
): Outcome {
  const a = toPayload(prev);
  const b = toPayload(state);
  const changed =
    a.active !== b.active ||
    (a.active &&
      b.active &&
      (a.stage !== b.stage || a.training !== b.training));
  return {
    state,
    notices: changed
      ? [...notices, { kind: 'stage', payload: b, at: now }]
      : notices,
  };
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
      const notify = report.gunma || test || (rec?.notify ?? false);
      const record: EewRecord =
        prec === 'new'
          ? {
              eventId: report.eventId,
              serial: report.serial,
              cancelled: report.cancelled,
              source: report.source,
              notify,
              discordMessageId: null,
            }
          : { ...rec!, source: 'p2p' };
      const eew = putRecord(state.eew, record);
      const next = {
        ...state,
        eew,
        alert: stepEew(state, report, prec, eew, now, test),
      };
      // 解除済みの地震の続報・取消も投稿する(表示の抑止はサイネージだけに効く)
      const notices: QuakeNotice[] =
        prec === 'new' && notify
          ? [{ kind: 'eew', op: 'post', report, receivedAt: now }]
          : prec === 'replace' && rec?.notify
            ? [{ kind: 'eew', op: 'edit', report, receivedAt: now }]
            : [];
      return withStageNotice(state, next, notices, now);
    }
    case 'observation': {
      const dis = state.dismissed.find((d) =>
        near(d.event.originTime, report.originTime),
      );
      const hi =
        report.maebashiMaxScale !== null &&
        report.maebashiMaxScale >= THRESHOLD_SCALE;
      // 解除した地震は、段階3に達していなかったときに5強以上と分かった場合だけ再表示する
      const suppressed = dis && !(hi && !dis.reachedEvacuate);
      const event = dis?.event ?? {
        eventId: null,
        originTime: report.originTime,
      };
      const post =
        report.gunmaStations && !state.seenObservation.includes(report.id);
      const next: RelayState = {
        ...state,
        dismissed:
          dis && !suppressed
            ? state.dismissed.filter((d) => d !== dis)
            : state.dismissed,
        alert: suppressed
          ? state.alert
          : stepObservation(state, report, now, event),
        seenObservation: post
          ? [...state.seenObservation, report.id].slice(-SEEN_OBSERVATION_LIMIT)
          : state.seenObservation,
      };
      const notices: QuakeNotice[] = post
        ? [{ kind: 'observation', report, receivedAt: now }]
        : [];
      return withStageNotice(state, next, notices, now);
    }
    case 'eqlist': {
      // 観測点を持たず群馬県に関係するかを決められないため投稿しない
      const next = { ...state, alert: stepEqlist(state, report, now) };
      return withStageNotice(state, next, [], now);
    }
  }
}

/** byは解除した実行委員(CMSのユーザーのメールアドレス)。表示中でなければ何もしない */
export function applyDismiss(
  state: RelayState,
  now: number,
  by: string,
): Outcome {
  const a = state.alert;
  if (!a) return { state, notices: [] };
  const dismissed = [
    ...state.dismissed,
    ...a.events.map((event) => ({ event, reachedEvacuate: a.reachedEvacuate })),
  ].slice(-DISMISSED_LIMIT);
  return {
    state: { ...state, alert: null, dismissed },
    notices: [{ kind: 'dismissed', by, training: a.training, at: now }],
  };
}

/** 投稿の応答のメッセージIDを、同じ報の記録にだけ保存する(記録が新しい報に進んでいれば何もしない) */
export function recordDiscordMessage(
  state: RelayState,
  key: EewKey,
  messageId: string,
): RelayState {
  const i = state.eew.findIndex(
    (r) =>
      r.eventId === key.eventId &&
      r.serial === key.serial &&
      r.cancelled === key.cancelled,
  );
  if (i < 0) return state;
  return {
    ...state,
    eew: state.eew.map((r, n) =>
      n === i ? { ...r, discordMessageId: messageId } : r,
    ),
  };
}

/** 無受信の閾値。P2Pは静かな時間が長いため長い */
export const SILENCE_LIMIT_MS: Readonly<Record<ChannelName, number>> = {
  p2p: 12 * 60_000,
  wolfxEew: 3 * 60_000,
  wolfxEqlist: 3 * 60_000,
};

export interface ChannelHealthInput {
  readonly connected: boolean;
  readonly lastReceivedAt: number | null;
  /** DOが起動した時刻。再起動の直後に受信不能と誤判定しないための基準 */
  readonly bootedAt: number;
}

/**
 * 接続の有無は見ない。再接続の一瞬の切れで受信状態の通知が往復しないよう、
 * 最後の受信(未受信なら起動)からの無受信の長さだけで決める
 */
export function isReceiving(
  channel: ChannelName,
  input: ChannelHealthInput,
  now: number,
): boolean {
  const since = Math.max(
    input.lastReceivedAt ?? input.bootedAt,
    input.bootedAt,
  );
  return now - since <= SILENCE_LIMIT_MS[channel];
}

/** P2PとWolfx(緊急地震速報)がともに受信できない */
export function isReceptionLost(
  receiving: Readonly<Record<ChannelName, boolean>>,
): boolean {
  return !receiving.p2p && !receiving.wolfxEew;
}
