// リレー・ハブ・端末・CMS が共有する。リレーとハブの Worker の型検査(DOM の型が無い)に
// 引き込まれるため、DOM の型に依存しない

export type SignageQuakeStage = 'warning' | 'calm' | 'evacuate' | 'cancelled';

export type SignageQuakeSource = 'p2p' | 'wolfx';

export interface SignageQuakeObservation {
  readonly source: SignageQuakeSource;
  /** 受信した発生時刻の文字列(日本時間、例"2023/05/26 19:03:00") */
  readonly originTime: string;
  /** 受信した震源名 */
  readonly hypocenter: string;
  /** 前橋市の観測点の最大震度の表示名。P2P で前橋市が載らないときと、Wolfx 由来のときは null */
  readonly maebashiIntensity: string | null;
  /** 最大震度の表示名(受信値) */
  readonly maxIntensity: string | null;
}

// 予想震度・到達予想時刻・猶予秒数は持たせない(自前の計算を表示しないため)
export type SignageQuakePayload =
  | { readonly active: false }
  | {
      readonly active: true;
      readonly stage: SignageQuakeStage;
      readonly training: boolean;
      /** 段階1・取消の根拠の警報の情報源。段階2・段階3の情報源は observation.source */
      readonly source: SignageQuakeSource;
      /** リレーが表示を始めた時刻(ISO) */
      readonly startedAt: string;
      /** リレーが最後に段階・受信値を変えた時刻(ISO) */
      readonly updatedAt: string;
      /** 段階2・段階3の根拠の地震情報。段階1・取消、地震情報を受けていないときは null */
      readonly observation: SignageQuakeObservation | null;
    };

const STAGES: readonly string[] = ['warning', 'calm', 'evacuate', 'cancelled'];

function isSource(v: unknown): v is SignageQuakeSource {
  return v === 'p2p' || v === 'wolfx';
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}

function isIsoString(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

function parseObservation(v: unknown): SignageQuakeObservation | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (
    !isSource(o.source) ||
    typeof o.originTime !== 'string' ||
    typeof o.hypocenter !== 'string' ||
    !isNullableString(o.maebashiIntensity) ||
    !isNullableString(o.maxIntensity)
  )
    return null;
  return {
    source: o.source,
    originTime: o.originTime,
    hypocenter: o.hypocenter,
    maebashiIntensity: o.maebashiIntensity,
    maxIntensity: o.maxIntensity,
  };
}

/** 端末側の検査。形が合わなければ null(表示しない) */
export function parseQuakePayload(value: unknown): SignageQuakePayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null;
  const o = value as Record<string, unknown>;
  if (o.active === false) return { active: false };
  if (o.active !== true) return null;
  if (
    typeof o.stage !== 'string' ||
    !STAGES.includes(o.stage) ||
    typeof o.training !== 'boolean' ||
    !isSource(o.source) ||
    !isIsoString(o.startedAt) ||
    !isIsoString(o.updatedAt)
  )
    return null;
  let observation: SignageQuakeObservation | null = null;
  if (o.observation !== null) {
    observation = parseObservation(o.observation);
    if (!observation) return null;
  }
  return {
    active: true,
    stage: o.stage as SignageQuakeStage,
    training: o.training,
    source: o.source,
    startedAt: o.startedAt,
    updatedAt: o.updatedAt,
    observation,
  };
}

const P2P_SCALE_LABELS: Readonly<Record<number, string>> = {
  10: '震度1',
  20: '震度2',
  30: '震度3',
  40: '震度4',
  45: '震度5弱',
  46: '震度5弱以上(推定)',
  50: '震度5強',
  55: '震度6弱',
  60: '震度6強',
  70: '震度7',
};

/** P2P の震度コードの表示名。未知のコードは null */
export function p2pScaleLabel(scale: number): string | null {
  return P2P_SCALE_LABELS[scale] ?? null;
}

/** 段階ごとの既定の文言。見出しと行動の箇条 */
export const QUAKE_DEFAULT_COPY: Readonly<
  Record<
    SignageQuakeStage,
    { readonly heading: string; readonly lines: readonly string[] }
  >
> = {
  warning: {
    heading: '地震です。落ち着いて身を守ってください',
    lines: [
      '頭を守ってください',
      '窓や吊り下げ物から離れてください',
      '出口に走らないでください',
    ],
  },
  calm: {
    heading: '揺れは収まりました',
    lines: ['その場で落ち着いてお待ちください'],
  },
  evacuate: {
    heading: '移動せずスタッフの指示を待ってください',
    lines: ['避難場所はスタッフが案内します'],
  },
  cancelled: {
    heading: '緊急地震速報は取り消されました',
    lines: ['落ち着いてお待ちください'],
  },
};
