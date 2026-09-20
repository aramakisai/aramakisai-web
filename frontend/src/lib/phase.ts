// Edge Runtime (middleware) から import されるため、外部 I/O・Node.js 専用 API・
// React への依存を一切持たない。

export type FestivalPhase = 'pre_event' | 'live';

export type PhaseSource = 'constant' | 'override';

export interface ResolvedPhase {
  readonly phase: FestivalPhase;
  readonly source: PhaseSource;
}

/**
 * 現在のフェーズ。切替はこの定数の変更と再デプロイによってのみ行う。
 */
export const BUILD_PHASE: FestivalPhase = 'pre_event';

/** フェーズオーバーライド Cookie の名称。 */
export const PHASE_OVERRIDE_COOKIE = 'aramakisai_phase_override';

// env.ts (`@t3-oss/env-nextjs`) 経由にすると proxy 越しのランタイム参照になり
// バンドラの定数畳み込みが効かず、本番成果物から開発用コードを除去できない。
// この理由により process.env を直接参照する。規約からの逸脱はこの 1 箇所に閉じる。
export const DEV_OVERRIDE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE === 'true' ||
  process.env.NODE_ENV === 'development';
