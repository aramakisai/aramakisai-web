export const TELOP_FIT_SEC = 8;
/** 調整用。流す文面の速さ */
export const TELOP_SPEED_PX_PER_SEC = 150;

export interface TelopSlot {
  readonly scroll: boolean;
  /** 秒単位に切り上げた表示秒数 */
  readonly durationSec: number;
}

/**
 * 流す距離は、文面の先頭が枠の右端に触れた位置から末尾が左端を抜けるまで。
 * 表示秒数を整数秒にするのは、端末ごとの文面幅の計測誤差で周期がずれ、
 * 端末間で表示中の件が食い違うのを防ぐため。
 */
export function telopSchedule(
  textWidths: readonly number[],
  boxWidth: number,
  speedPxPerSec: number = TELOP_SPEED_PX_PER_SEC,
): readonly TelopSlot[] {
  return textWidths.map((textWidth) =>
    textWidth <= boxWidth
      ? { scroll: false, durationSec: TELOP_FIT_SEC }
      : {
          scroll: true,
          durationSec: Math.ceil((textWidth + boxWidth) / speedPxPerSec),
        },
  );
}

/** 周期 = 表示秒数の合計。nowMs mod 周期から現在の件と流し位置を返す。周期が0ならnull */
export function telopAt(
  schedule: readonly TelopSlot[],
  boxWidth: number,
  nowMs: number,
  speedPxPerSec: number = TELOP_SPEED_PX_PER_SEC,
): { readonly index: number; readonly translateX: number } | null {
  const cycleMs = schedule.reduce((sum, s) => sum + s.durationSec, 0) * 1000;
  if (cycleMs <= 0) return null;
  let t = ((nowMs % cycleMs) + cycleMs) % cycleMs;
  for (let index = 0; index < schedule.length; index++) {
    const ms = schedule[index].durationSec * 1000;
    if (t < ms) {
      return {
        index,
        translateX: schedule[index].scroll
          ? boxWidth - (speedPxPerSec * t) / 1000
          : 0,
      };
    }
    t -= ms;
  }
  return null;
}
