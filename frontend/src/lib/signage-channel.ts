import type { SignageSlide } from './signage';

/** ハブが配る固定と表示対象 */
// 型の正本はここ。signage-pin.ts は React に依存し、ハブの Worker(DOM の型が無い)の型検査に
// 引き込めないため、SignagePinState 側がこれを継承する
export interface SignagePinPayload {
  readonly slide: SignageSlide | null;
  readonly visibleSlideIds: readonly number[];
}

/** スナップショットの版。版が変わったら端末は /api/signage?v=<version> を取り直す */
export interface SignageSnapshotPayload {
  /** ハブが取り直しを決めた時刻(epoch ms)。単調増加 */
  readonly version: number;
}

/** 機能名 → payload の型。他機能はここにキーを足す */
export interface SignageFeaturePayloads {
  readonly pin: SignagePinPayload;
  readonly snapshot: SignageSnapshotPayload;
}

export type SignageFeature = keyof SignageFeaturePayloads;

/** 他機能がハブへ渡すもの。sentAt はハブが付ける */
export type SignagePublishInput = {
  [F in SignageFeature]: {
    readonly feature: F;
    readonly payload: SignageFeaturePayloads[F];
    /** ISO 8601。null は期限なし。過ぎたら端末は表示に使わず、ハブは保持から捨てる */
    readonly expiresAt: string | null;
  };
}[SignageFeature];

export type SignageBroadcast = SignagePublishInput & {
  readonly kind: 'broadcast';
  /** ハブが送った時刻(ISO) */
  readonly sentAt: string;
};

export type SignageServerMessage = SignageBroadcast;

// ハブの DO を休止させるため、ping への pong は ctx.setWebSocketAutoResponse が JSON を介さず返す
export const SIGNAGE_PING = 'ping';
export const SIGNAGE_PONG = 'pong';

export const SIGNAGE_PING_INTERVAL_MS = 5_000;
export const SIGNAGE_PONG_TIMEOUT_MS = 5_000;

/** 補正済みの現在時刻で期限を判定する。expiresAt が null なら常に偽 */
export function isExpired(
  message: Pick<SignageBroadcast, 'expiresAt'>,
  nowMs: number,
): boolean {
  if (message.expiresAt === null) return false;
  // NaN との比較は常に偽になり期限切れを素通しするので、解釈できない日時は期限切れに倒す
  const expiry = Date.parse(message.expiresAt);
  return Number.isNaN(expiry) || nowMs >= expiry;
}

function parseObject(raw: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

/** 受信した文字列を解釈する。形の合わないものは null。未知の feature の broadcast は返す */
export function parseServerMessage(raw: string): SignageServerMessage | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  if (obj.kind === 'broadcast') {
    const { feature, payload, expiresAt, sentAt } = obj;
    if (typeof feature !== 'string' || typeof sentAt !== 'string') return null;
    if (expiresAt !== null && typeof expiresAt !== 'string') return null;
    if (typeof payload !== 'object' || payload === null) return null;
    // payload の中身は各機能の受け取り側が検査する。未知の feature もここでは型を信じて返す
    return obj as unknown as SignageBroadcast;
  }
  return null;
}
