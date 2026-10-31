/**
 * カードの中身を、sticky の見出しの下端 (limitTop) より上へ隠さないための下方向の移動量。
 * カードの上端が limitTop より上に出た分だけ動かし、中身の下端がカードの下端に着いたところで止める。
 * 中身がカードより低くない場合は動かす余地がなく 0。
 */
export function stickyOffset(
  cardTop: number,
  cardHeight: number,
  contentHeight: number,
  limitTop: number,
): number {
  const travel = cardHeight - contentHeight;
  if (travel <= 0) return 0;
  return Math.min(Math.max(limitTop - cardTop, 0), travel);
}
