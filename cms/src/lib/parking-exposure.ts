export type ImageQuality = 'ok' | 'too_dark' | 'too_bright' | 'color_cast';

export interface ExposureBasis {
  readonly quality: ImageQuality;
  /** 判定した画像を撮ったときの露出補正値 */
  readonly exposure: number;
  /** 判定した画像の撮影時刻 */
  readonly capturedAt: string;
}

// 公開ページの状態の古さと同じ値。前日夕方の起点で翌朝の撮影を補正しないため
const BASIS_TTL_MS = 30 * 60 * 1000;

const DELTA: Record<ImageQuality, number> = { ok: 0, color_cast: 0, too_dark: 1, too_bright: -1 };

export function nextExposure(basis: ExposureBasis | null, now: Date): number | null {
  if (!basis) return null;
  if (now.getTime() - Date.parse(basis.capturedAt) > BASIS_TTL_MS) return null;
  return Math.max(-2, Math.min(2, basis.exposure + DELTA[basis.quality]));
}
