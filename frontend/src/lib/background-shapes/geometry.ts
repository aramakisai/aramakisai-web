import type { Rect, ShapeKind } from './types';

/**
 * 図形の内外判定・文字矩形との重なり面積比・不透明な面の可視率・ガター判定を、
 * 参照実装 place.py と同じ 40x40 格子の標本化で近似する。閉形式の幾何計算に
 * 置き換えない (design.md 参照): 配置は乱数で候補を引いては棄却する逐次試行なので、
 * 1 つの候補で判定が食い違うとそれ以降の乱数の消費がずれ、結果全体が変わる。
 *
 * 配置ループは 1 候補あたりこの標本化を数千回描き直すホットパス。以下の関数は
 * 素朴な実装 (格子生成→内外判定→回転→矩形フィルタを別々の配列で行う) と
 * 数式・評価順序が完全に同じまま、中間配列と対象外の点への計算を省いて
 * 高速化したもの。golden テストの 0.01px 精度・棄却判定の一致を壊さないよう、
 * 各式は元の実装と同じ項の並び・同じ丸め順で書く。
 */
export const GRID_N = 40;

interface Points {
  px: number[];
  py: number[];
}

interface PlacedCircle {
  cx: number;
  cy: number;
  r: number;
}

function linspaceCenters(span: number, n: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    out[i] = ((i + 0.5) / n) * span - span / 2;
  }
  return out;
}

export function sampleShape(
  kind: ShapeKind,
  s: number,
  rotationDeg: number,
  cx: number,
  cy: number,
  n = GRID_N,
): Points {
  const lin = linspaceCenters(s, n);
  const th = (rotationDeg * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);

  // 各 kind の閾値は s に対して線形なので、点ループの外で一度だけ計算する
  // (kindMask がループの外で行っていたのと同じ前計算)。
  let r2 = 0;
  let half = 0;
  let rr = 0;
  let halfRS = 0;
  switch (kind) {
    case 'circle':
    case 'semicircle':
      r2 = (s / 2) * (s / 2);
      break;
    case 'square':
      half = s / 2;
      break;
    case 'roundedSquare':
      rr = s * 0.18;
      halfRS = s / 2 - rr;
      break;
    case 'quarterCircle':
      r2 = s * s;
      break;
    case 'triangle':
      break;
    default:
      throw new Error(kind satisfies never);
  }

  const px = new Array<number>(n * n);
  const py = new Array<number>(n * n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const y = lin[i];
    for (let j = 0; j < n; j++) {
      const x = lin[j];
      let inside: boolean;
      switch (kind) {
        case 'circle':
          inside = x * x + y * y <= r2;
          break;
        case 'square':
          inside = Math.abs(x) <= half && Math.abs(y) <= half;
          break;
        case 'roundedSquare': {
          const qx = Math.abs(x) - halfRS;
          const qy = Math.abs(y) - halfRS;
          const d =
            Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
            Math.min(Math.max(qx, qy), 0) -
            rr;
          inside = d <= 0;
          break;
        }
        case 'triangle': {
          const halfw = (y + s / 2) / 2;
          inside = Math.abs(x) <= halfw && y >= -s / 2 && y <= s / 2;
          break;
        }
        case 'quarterCircle': {
          const qcx = x + s / 2;
          const qcy = y + s / 2;
          inside = qcx * qcx + qcy * qcy <= r2;
          break;
        }
        case 'semicircle':
          inside = x * x + y * y <= r2 && y >= 0;
          break;
      }
      if (inside) {
        px[count] = x * ct - y * st + cx;
        py[count] = x * st + y * ct + cy;
        count++;
      }
    }
  }
  px.length = count;
  py.length = count;
  return { px, py };
}

// sampleShape + boundsAndBbox (の存在判定部分のみ) を融合したもの。1点でも
// decorTop/decorBottom・はみ出し許容量を超えた時点で残りの格子点の生成を打ち切り
// null を返す。「はみ出す点が1つでも存在するか」は boundsAndBbox の
// pyMin/pyMax/pxMin/pxMax による判定と数学的に同値 (存在命題として書き直しただけ)。
// bb は追わない (呼び出し側の validX が boundsAndBbox で改めて求める) — 追跡すると
// 生成を通過する側の候補にまで比較・代入が常時かかり、計測上はむしろ遅くなった。
// 配置ループでは候補の約4割がここで棄却される (news-list-sp 実測) ため、40x40 格子
// を最後まで生成せずに打ち切れる効果が大きい。ホットループ内なので sampleShape と
// 処理を共有せず重複させている。
export function sampleShapeIfBounds(
  kind: ShapeKind,
  s: number,
  rotationDeg: number,
  cx: number,
  cy: number,
  width: number,
  decorTop: number,
  decorBottom: number,
  overflowFrac: number,
  n = GRID_N,
): Points | null {
  const lin = linspaceCenters(s, n);
  const th = (rotationDeg * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);

  let r2 = 0;
  let half = 0;
  let rr = 0;
  let halfRS = 0;
  switch (kind) {
    case 'circle':
    case 'semicircle':
      r2 = (s / 2) * (s / 2);
      break;
    case 'square':
      half = s / 2;
      break;
    case 'roundedSquare':
      rr = s * 0.18;
      halfRS = s / 2 - rr;
      break;
    case 'quarterCircle':
      r2 = s * s;
      break;
    case 'triangle':
      break;
    default:
      throw new Error(kind satisfies never);
  }

  const allow = overflowFrac * s;
  const yLo = decorTop - 1e-6;
  const yHi = decorBottom + 1e-6;
  const xLo = -(allow + 1e-6);
  const xHi = width + allow + 1e-6;

  const px = new Array<number>(n * n);
  const py = new Array<number>(n * n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const y = lin[i];
    for (let j = 0; j < n; j++) {
      const x = lin[j];
      let inside: boolean;
      switch (kind) {
        case 'circle':
          inside = x * x + y * y <= r2;
          break;
        case 'square':
          inside = Math.abs(x) <= half && Math.abs(y) <= half;
          break;
        case 'roundedSquare': {
          const qx = Math.abs(x) - halfRS;
          const qy = Math.abs(y) - halfRS;
          const d =
            Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
            Math.min(Math.max(qx, qy), 0) -
            rr;
          inside = d <= 0;
          break;
        }
        case 'triangle': {
          const halfw = (y + s / 2) / 2;
          inside = Math.abs(x) <= halfw && y >= -s / 2 && y <= s / 2;
          break;
        }
        case 'quarterCircle': {
          const qcx = x + s / 2;
          const qcy = y + s / 2;
          inside = qcx * qcx + qcy * qcy <= r2;
          break;
        }
        case 'semicircle':
          inside = x * x + y * y <= r2 && y >= 0;
          break;
      }
      if (inside) {
        const X = x * ct - y * st + cx;
        const Y = x * st + y * ct + cy;
        if (Y < yLo || Y > yHi || X < xLo || X > xHi) return null;
        px[count] = X;
        py[count] = Y;
        count++;
      }
    }
  }
  px.length = count;
  py.length = count;
  return { px, py };
}

export function bboxRadius(s: number): number {
  return (s * Math.sqrt(2)) / 2; // 回転しても外接円は同じ (中心まわりの回転で不変)
}

export function infBbox(D: number): [w: number, h: number] {
  return [0.74 * D + D, D];
}

export function infRadius(D: number): number {
  const [w, h] = infBbox(D);
  return 0.5 * Math.hypot(w, h);
}

export function sampleInf(
  D: number,
  rotationDeg: number,
  cx: number,
  cy: number,
  n = GRID_N,
): Points {
  const [w, h] = infBbox(D);
  const linX = linspaceCenters(w, n);
  const linY = linspaceCenters(h, n);
  const r2 = (D / 2) * (D / 2);
  const cxa = -0.37 * D;
  const cxb = 0.37 * D; // 中心間距離 0.74D
  const th = (rotationDeg * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);

  const px = new Array<number>(n * n);
  const py = new Array<number>(n * n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const y = linY[i];
    for (let j = 0; j < n; j++) {
      const x = linX[j];
      // y ** 2 は OR の両辺で同じ値なので1回だけ計算する (元の式は右辺評価時に
      // 再計算していた)
      const y2 = y * y;
      const dxa = x - cxa;
      const dxb = x - cxb;
      if (dxa * dxa + y2 <= r2 || dxb * dxb + y2 <= r2) {
        px[count] = x * ct - y * st + cx;
        py[count] = x * st + y * ct + cy;
        count++;
      }
    }
  }
  px.length = count;
  py.length = count;
  return { px, py };
}

// sampleShapeIfBounds と同じ考え方の ∞ 版。∞ は overflowFrac=0.0 固定 (validInf の
// boundsAndBbox 呼び出しと同じ) なので引数に取らない。
export function sampleInfIfBounds(
  D: number,
  rotationDeg: number,
  cx: number,
  cy: number,
  width: number,
  decorTop: number,
  decorBottom: number,
  n = GRID_N,
): Points | null {
  const [w, h] = infBbox(D);
  const linX = linspaceCenters(w, n);
  const linY = linspaceCenters(h, n);
  const r2 = (D / 2) * (D / 2);
  const cxa = -0.37 * D;
  const cxb = 0.37 * D;
  const th = (rotationDeg * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);

  const yLo = decorTop - 1e-6;
  const yHi = decorBottom + 1e-6;
  const xLo = -1e-6;
  const xHi = width + 1e-6;

  const px = new Array<number>(n * n);
  const py = new Array<number>(n * n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const y = linY[i];
    for (let j = 0; j < n; j++) {
      const x = linX[j];
      const y2 = y * y;
      const dxa = x - cxa;
      const dxb = x - cxb;
      if (dxa * dxa + y2 <= r2 || dxb * dxb + y2 <= r2) {
        const X = x * ct - y * st + cx;
        const Y = x * st + y * ct + cy;
        if (Y < yLo || Y > yHi || X < xLo || X > xHi) return null;
        px[count] = X;
        py[count] = Y;
        count++;
      }
    }
  }
  px.length = count;
  py.length = count;
  return { px, py };
}

// Math.min/max(...arr) と同じ値 (空配列なら [Infinity, -Infinity]) を、
// 引数展開の呼び出しコストなしで求める。min/max は比較による選択なので
// 手書きループでも丸め誤差は生まれず、元の実装とビット単位で一致する。
function minMax(arr: readonly number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

export function bboxOf(px: number[], py: number[]): Rect {
  const [xmin, xmax] = minMax(px);
  const [ymin, ymax] = minMax(py);
  return { x: xmin, y: ymin, w: xmax - xmin, h: ymax - ymin };
}

export function boundsOk(
  px: number[],
  py: number[],
  width: number,
  decorTop: number,
  decorBottom: number,
  overflowFrac: number,
  s: number,
): boolean {
  const [pyMin, pyMax] = minMax(py);
  if (pyMin < decorTop - 1e-6 || pyMax > decorBottom + 1e-6) return false;
  const allow = overflowFrac * s;
  const [pxMin, pxMax] = minMax(px);
  const leftOver = Math.max(0, -pxMin);
  const rightOver = Math.max(0, pxMax - width);
  return leftOver <= allow + 1e-6 && rightOver <= allow + 1e-6;
}

// boundsOk と bboxOf は同じ px/py の min/max を別々に (2 回ずつ) 計算し直していた。
// 候補ループでは両方とも毎回必要になるので、min/max を1回だけ求めて両方の値を
// 作る。判定式は boundsOk と同じ順序 (py を先に見て早期棄却) ・同じ項のまま。
function boundsAndBbox(
  px: number[],
  py: number[],
  width: number,
  decorTop: number,
  decorBottom: number,
  overflowFrac: number,
  s: number,
): { ok: boolean; bb: Rect | null } {
  const [pyMin, pyMax] = minMax(py);
  if (pyMin < decorTop - 1e-6 || pyMax > decorBottom + 1e-6) {
    return { ok: false, bb: null };
  }
  const allow = overflowFrac * s;
  const [pxMin, pxMax] = minMax(px);
  const leftOver = Math.max(0, -pxMin);
  const rightOver = Math.max(0, pxMax - width);
  const ok = leftOver <= allow + 1e-6 && rightOver <= allow + 1e-6;
  const bb: Rect = { x: pxMin, y: pyMin, w: pxMax - pxMin, h: pyMax - pyMin };
  return { ok, bb };
}

export function collisionOk(
  cx: number,
  cy: number,
  r: number,
  placed: readonly PlacedCircle[],
  gap: number,
): boolean {
  for (const p of placed) {
    if (Math.hypot(cx - p.cx, cy - p.cy) < r + p.r + gap) return false;
  }
  return true;
}

export function gutterCount(
  shapeBbox: Rect,
  opaqueRects: readonly Rect[],
): number {
  let count = 0;
  for (const o of opaqueRects) if (rectsIntersect(shapeBbox, o)) count++;
  return count;
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

export function pad(rects: readonly Rect[], m: number): Rect[] {
  return rects.map((r) => ({
    x: r.x - m,
    y: r.y - m,
    w: r.w + 2 * m,
    h: r.h + 2 * m,
  }));
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function inAny(
  px: number[],
  py: number[],
  rects: readonly Rect[],
): boolean[] {
  const n = px.length;
  const out = new Array<boolean>(n);
  const rn = rects.length;
  for (let i = 0; i < n; i++) {
    const x = px[i];
    const y = py[i];
    let hit = false;
    for (let k = 0; k < rn; k++) {
      if (pointInRect(x, y, rects[k])) {
        hit = true;
        break;
      }
    }
    out[i] = hit;
  }
  return out;
}

// anyTrue(inAny(...)) と同じ真偽値を、点×矩形の全探索を待たず最初の1点で
// 打ち切って求める (checkCommon 等、配置ループの全候補で毎回呼ばれるホットパス)。
function anyInAny(px: number[], py: number[], rects: readonly Rect[]): boolean {
  const rn = rects.length;
  if (rn === 0) return false;
  for (let i = 0; i < px.length; i++) {
    const x = px[i];
    const y = py[i];
    for (let k = 0; k < rn; k++) {
      if (pointInRect(x, y, rects[k])) return true;
    }
  }
  return false;
}

// meanTrue(inAny(...)) と同じ比率を中間の bool 配列なしで求める。
function meanInAny(px: number[], py: number[], rects: readonly Rect[]): number {
  const n = px.length;
  if (n === 0 || rects.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (anyInAnySingle(px[i], py[i], rects)) count++;
  }
  return count / n;
}

function anyInAnySingle(x: number, y: number, rects: readonly Rect[]): boolean {
  for (let k = 0; k < rects.length; k++) {
    if (pointInRect(x, y, rects[k])) return true;
  }
  return false;
}

// meanTrue(inAny(...).map(v => !v)) と同じ値を求める。true 数を n から引いて
// 割る、という元の実装と同じ整数演算の順序を保つ (1 - meanInAny(...) にすると
// 除算が2回に増え丸め方が変わりうる)。
function meanNotInAny(
  px: number[],
  py: number[],
  rects: readonly Rect[],
): number {
  const n = px.length;
  if (n === 0) return 0;
  let countIn = 0;
  for (let i = 0; i < n; i++) {
    if (anyInAnySingle(px[i], py[i], rects)) countIn++;
  }
  return (n - countIn) / n;
}

export function checkCommon(
  px: number[],
  py: number[],
  noOverlapPad: readonly Rect[],
): boolean {
  return !anyInAny(px, py, noOverlapPad);
}

// bb (候補図形の実際の標本点が収まる厳密な外接矩形) と交差しない矩形は、
// どの標本点にも触れ得ない (bb はその点集合ちょうどの外接矩形なので)。
// これらを内外判定の対象から除いても真偽値・比率は一切変わらない。text 矩形が
// 数十枚あるページ (news-list-sp 等) で 1600 点 × 矩形数の総当たりを減らす。
function rectsNear(bb: Rect, rects: readonly Rect[]): readonly Rect[] {
  if (rects.length === 0) return rects;
  const out: Rect[] = [];
  for (const r of rects) if (rectsIntersect(bb, r)) out.push(r);
  return out;
}

export function validS(
  px: number[],
  py: number[],
  width: number,
  decorTop: number,
  decorBottom: number,
  noOverlapPad: readonly Rect[],
  textPad: readonly Rect[],
  opaque: readonly Rect[],
  s: number,
  overflowFrac: number,
  opaqueMode: 'hard' | 'soft',
): boolean {
  const bounds = boundsAndBbox(
    px,
    py,
    width,
    decorTop,
    decorBottom,
    overflowFrac,
    s,
  );
  if (!bounds.ok) return false;
  const bb = bounds.bb!; // ok=true のとき boundsAndBbox は必ず bb を返す
  if (!checkCommon(px, py, rectsNear(bb, noOverlapPad))) return false;
  if (anyInAny(px, py, rectsNear(bb, textPad))) return false;
  const nearOpaque = rectsNear(bb, opaque);
  if (opaqueMode === 'hard') {
    if (anyInAny(px, py, nearOpaque)) return false;
  } else {
    if (gutterCount(bb, opaque) >= 2) return false;
    if (meanNotInAny(px, py, nearOpaque) < 0.7) return false;
  }
  return true;
}

export function validL(
  px: number[],
  py: number[],
  width: number,
  decorTop: number,
  decorBottom: number,
  noOverlapPad: readonly Rect[],
  textRaw: readonly Rect[],
  opaque: readonly Rect[],
  s: number,
  minVisible = 0.6,
): boolean {
  const bounds = boundsAndBbox(px, py, width, decorTop, decorBottom, 0.4, s);
  if (!bounds.ok) return false;
  const bb = bounds.bb!; // ok=true のとき boundsAndBbox は必ず bb を返す
  if (!checkCommon(px, py, rectsNear(bb, noOverlapPad))) return false;
  if (textRaw.length > 0) {
    const ratio = meanInAny(px, py, rectsNear(bb, textRaw));
    if (ratio > 0.25) return false;
  }
  if (gutterCount(bb, opaque) >= 2) return false;
  const nearOpaque = rectsNear(bb, opaque);
  let visibleCount = 0;
  for (let i = 0; i < px.length; i++) {
    const x = px[i];
    const onPage = x >= 0 && x <= width;
    if (onPage && !anyInAnySingle(x, py[i], nearOpaque)) visibleCount++;
  }
  if (visibleCount / px.length < minVisible) return false;
  return true;
}

/**
 * ∞ の配置検証。opaque_mode='hard' は従来通り不透明面と一切重ならないことを
 * 要求する。'soft' は L の最終緩和 (カードの裏に回す。可視率0.6→0.25、
 * ガター禁止は維持) と同じ考え方を∞にも適用したもの。text_mode='hard' は文字と一切重ならない
 * (従来通り)。'ratio25' は L と同じ基準(面積比25%以下)で黒文字との重なりを許す
 * 最終段。opaque と text の緩和は互いに独立(組み合わせない、単独でのみ緩める)。
 */
export function validInf(
  px: number[],
  py: number[],
  width: number,
  decorTop: number,
  decorBottom: number,
  noOverlapPad: readonly Rect[],
  textPad: readonly Rect[],
  opaque: readonly Rect[],
  D: number,
  opaqueMode: 'hard' | 'soft' = 'hard',
  minVisible = 1.0,
  textMode: 'hard' | 'ratio25' = 'hard',
  textRaw: readonly Rect[] = [],
): boolean {
  const bounds = boundsAndBbox(px, py, width, decorTop, decorBottom, 0.0, D);
  if (!bounds.ok) return false;
  const bb = bounds.bb!; // ok=true のとき boundsAndBbox は必ず bb を返す
  if (!checkCommon(px, py, rectsNear(bb, noOverlapPad))) return false;
  if (textMode === 'hard') {
    if (anyInAny(px, py, rectsNear(bb, textPad))) return false;
  } else {
    if (textRaw.length > 0) {
      const ratio = meanInAny(px, py, rectsNear(bb, textRaw));
      if (ratio > 0.25) return false;
    }
  }
  if (opaqueMode === 'hard') {
    if (anyInAny(px, py, rectsNear(bb, opaque))) return false;
  } else {
    if (gutterCount(bb, opaque) >= 2) return false;
    if (meanNotInAny(px, py, rectsNear(bb, opaque)) < minVisible) return false;
  }
  return true;
}
