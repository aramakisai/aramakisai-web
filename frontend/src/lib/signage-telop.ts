export const TELOP_FIT_MS = 8000;
/** 調整用。流す文面の速さ */
export const TELOP_SPEED_PX_PER_SEC = 150;

export interface TelopPlan {
  readonly scroll: boolean;
  readonly durationMs: number;
}

/** 流す距離は、文面の先頭が枠の右端に触れた位置から末尾が左端を抜けるまで */
export function telopPlan(
  textWidth: number,
  boxWidth: number,
  speedPxPerSec: number = TELOP_SPEED_PX_PER_SEC,
): TelopPlan {
  if (textWidth <= boxWidth) return { scroll: false, durationMs: TELOP_FIT_MS };
  return {
    scroll: true,
    durationMs: ((textWidth + boxWidth) / speedPxPerSec) * 1000,
  };
}

/** ポーリングで件数が減っても範囲外を指さないよう先頭へ戻す */
export function nextTelopIndex(current: number, count: number): number {
  const next = current + 1;
  return next < count ? next : 0;
}
