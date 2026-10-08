import type { SignageOrientation } from './signage';

export const TELOP_FIT_SEC = 8;
/** 調整用。流す文面の速さ */
export const TELOP_SPEED_PX_PER_SEC = 150;

// SignageTelop の帯幅(816/1032px)から左右余白 px-6 を引いた内寸と、対象チップとの間隔 gap-5
const TELOP_INNER_WIDTH: Readonly<Record<SignageOrientation, number>> = {
  landscape: 816 - 48,
  portrait: 1032 - 48,
};
const TELOP_CHIP_GAP = 20;

/** 文面を流す枠の幅(設計座標)。対象チップの幅だけ狭まる */
export function telopBoxWidth(
  orientation: SignageOrientation,
  chipWidth: number,
): number {
  return TELOP_INNER_WIDTH[orientation] - chipWidth - TELOP_CHIP_GAP;
}

export interface TelopSlot {
  readonly scroll: boolean;
  /** 秒単位に切り上げた表示秒数 */
  readonly durationSec: number;
}

/**
 * 時刻表を向きに依らず決め、横型と縦型の端末で周期と件を揃える。
 * 収まるかは狭い横型の枠で判定し、流す時間は広い縦型の枠で流し切る長さにする。
 * 表示秒数を整数秒にするのは、端末ごとの文面幅の計測誤差で周期がずれ、
 * 端末間で表示中の件が食い違うのを防ぐため。
 */
export function telopSchedule(
  textWidths: readonly number[],
  chipWidths: readonly number[],
  speedPxPerSec: number = TELOP_SPEED_PX_PER_SEC,
): readonly TelopSlot[] {
  return textWidths.map((textWidth, i) => {
    const chip = chipWidths[i] ?? 0;
    return textWidth <= telopBoxWidth('landscape', chip)
      ? { scroll: false, durationSec: TELOP_FIT_SEC }
      : {
          scroll: true,
          durationSec: Math.ceil(
            (textWidth + telopBoxWidth('portrait', chip)) / speedPxPerSec,
          ),
        };
  });
}

/**
 * 周期 = 表示秒数の合計。nowMs mod 周期から現在の件と、流す件なら枠の右端から流れた距離を返す
 * (流さない件はnull)。周期が0ならnull
 */
export function telopAt(
  schedule: readonly TelopSlot[],
  nowMs: number,
  speedPxPerSec: number = TELOP_SPEED_PX_PER_SEC,
): { readonly index: number; readonly scrolledPx: number | null } | null {
  const cycleMs = schedule.reduce((sum, s) => sum + s.durationSec, 0) * 1000;
  if (cycleMs <= 0) return null;
  let t = ((nowMs % cycleMs) + cycleMs) % cycleMs;
  for (let index = 0; index < schedule.length; index++) {
    const ms = schedule[index].durationSec * 1000;
    if (t < ms) {
      return {
        index,
        scrolledPx: schedule[index].scroll ? (speedPxPerSec * t) / 1000 : null,
      };
    }
    t -= ms;
  }
  return null;
}
