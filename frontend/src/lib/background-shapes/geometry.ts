import type { Rect, ShapeKind } from './types';

/**
 * 図形の内外判定・文字矩形との重なり面積比・不透明な面の可視率・ガター判定を、
 * 参照実装 place.py と同じ 40x40 格子の標本化で近似する。閉形式の幾何計算に
 * 置き換えない (design.md 参照): 配置は乱数で候補を引いては棄却する逐次試行なので、
 * 1 つの候補で判定が食い違うとそれ以降の乱数の消費がずれ、結果全体が変わる。
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

// 中心原点、外接 s x s の窓の中に局所座標の格子 (n x n) を作る
function localGrid(s: number, n = GRID_N): { X: number[]; Y: number[] } {
  const lin = linspaceCenters(s, n);
  const X: number[] = [];
  const Y: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      X.push(lin[j]);
      Y.push(lin[i]);
    }
  }
  return { X, Y };
}

function kindMask(kind: ShapeKind, X: number[], Y: number[], s: number): boolean[] {
  const n = X.length;
  const mask = new Array<boolean>(n);
  switch (kind) {
    case 'circle': {
      const r2 = (s / 2) ** 2;
      for (let i = 0; i < n; i++) mask[i] = X[i] ** 2 + Y[i] ** 2 <= r2;
      break;
    }
    case 'square': {
      const half = s / 2;
      for (let i = 0; i < n; i++) mask[i] = Math.abs(X[i]) <= half && Math.abs(Y[i]) <= half;
      break;
    }
    case 'roundedSquare': {
      // ルールに数値指定なし。見本の角丸感に合わせた固定比率
      const r = s * 0.18;
      const half = s / 2 - r;
      for (let i = 0; i < n; i++) {
        const qx = Math.abs(X[i]) - half;
        const qy = Math.abs(Y[i]) - half;
        const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        mask[i] = d <= 0;
      }
      break;
    }
    case 'triangle': {
      // 頂点が上、底辺が下で外接正方形 s x s を満たす二等辺三角形
      for (let i = 0; i < n; i++) {
        const halfw = (Y[i] + s / 2) / 2;
        mask[i] = Math.abs(X[i]) <= halfw && Y[i] >= -s / 2 && Y[i] <= s / 2;
      }
      break;
    }
    case 'quarterCircle': {
      // 半径 s の扇、外接正方形の角を (-s/2,-s/2) に置くと弧が残り2辺の中点を通り s x s に収まる
      const r2 = s ** 2;
      for (let i = 0; i < n; i++) mask[i] = (X[i] + s / 2) ** 2 + (Y[i] + s / 2) ** 2 <= r2;
      break;
    }
    case 'semicircle': {
      // 直径 = 一辺。窓の下半分だけを占める (向きは回転で乱数化されるので固定でよい)
      const r = s / 2;
      const r2 = r ** 2;
      for (let i = 0; i < n; i++) mask[i] = X[i] ** 2 + Y[i] ** 2 <= r2 && Y[i] >= 0;
      break;
    }
    default:
      throw new Error(kind satisfies never);
  }
  return mask;
}

function toPage(X: number[], Y: number[], rotationDeg: number, cx: number, cy: number): Points {
  const th = (rotationDeg * Math.PI) / 180;
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const n = X.length;
  const px = new Array<number>(n);
  const py = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    px[i] = X[i] * ct - Y[i] * st + cx;
    py[i] = X[i] * st + Y[i] * ct + cy;
  }
  return { px, py };
}

function filterByMask(px: number[], py: number[], mask: boolean[]): Points {
  const outX: number[] = [];
  const outY: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      outX.push(px[i]);
      outY.push(py[i]);
    }
  }
  return { px: outX, py: outY };
}

export function sampleShape(kind: ShapeKind, s: number, rotationDeg: number, cx: number, cy: number): Points {
  const { X, Y } = localGrid(s);
  const mask = kindMask(kind, X, Y, s);
  const { px, py } = toPage(X, Y, rotationDeg, cx, cy);
  return filterByMask(px, py, mask);
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

export function sampleInf(D: number, rotationDeg: number, cx: number, cy: number, n = GRID_N): Points {
  const [w, h] = infBbox(D);
  const linX = linspaceCenters(w, n);
  const linY = linspaceCenters(h, n);
  const X: number[] = [];
  const Y: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      X.push(linX[j]);
      Y.push(linY[i]);
    }
  }
  const r = D / 2;
  const r2 = r ** 2;
  const cxa = -0.37 * D;
  const cxb = 0.37 * D; // 中心間距離 0.74D
  const mask = X.map((x, i) => (x - cxa) ** 2 + Y[i] ** 2 <= r2 || (x - cxb) ** 2 + Y[i] ** 2 <= r2);
  const { px, py } = toPage(X, Y, rotationDeg, cx, cy);
  return filterByMask(px, py, mask);
}

function inRect(px: number[], py: number[], rect: Rect): boolean[] {
  const n = px.length;
  const out = new Array<boolean>(n);
  for (let i = 0; i < n; i++) {
    out[i] = px[i] >= rect.x && px[i] <= rect.x + rect.w && py[i] >= rect.y && py[i] <= rect.y + rect.h;
  }
  return out;
}

export function inAny(px: number[], py: number[], rects: readonly Rect[]): boolean[] {
  const out = new Array<boolean>(px.length).fill(false);
  for (const rect of rects) {
    const m = inRect(px, py, rect);
    for (let i = 0; i < out.length; i++) out[i] = out[i] || m[i];
  }
  return out;
}

function anyTrue(mask: boolean[]): boolean {
  return mask.some((v) => v);
}

function meanTrue(mask: boolean[]): number {
  if (mask.length === 0) return 0;
  let c = 0;
  for (const v of mask) if (v) c++;
  return c / mask.length;
}

export function pad(rects: readonly Rect[], m: number): Rect[] {
  return rects.map((r) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m }));
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function bboxOf(px: number[], py: number[]): Rect {
  const xmin = Math.min(...px);
  const xmax = Math.max(...px);
  const ymin = Math.min(...py);
  const ymax = Math.max(...py);
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
  const pyMin = Math.min(...py);
  const pyMax = Math.max(...py);
  if (pyMin < decorTop - 1e-6 || pyMax > decorBottom + 1e-6) return false;
  const allow = overflowFrac * s;
  const pxMin = Math.min(...px);
  const pxMax = Math.max(...px);
  const leftOver = Math.max(0, -pxMin);
  const rightOver = Math.max(0, pxMax - width);
  return leftOver <= allow + 1e-6 && rightOver <= allow + 1e-6;
}

export function collisionOk(cx: number, cy: number, r: number, placed: readonly PlacedCircle[], gap: number): boolean {
  for (const p of placed) {
    if (Math.hypot(cx - p.cx, cy - p.cy) < r + p.r + gap) return false;
  }
  return true;
}

export function gutterCount(shapeBbox: Rect, opaqueRects: readonly Rect[]): number {
  let count = 0;
  for (const o of opaqueRects) if (rectsIntersect(shapeBbox, o)) count++;
  return count;
}

export function checkCommon(px: number[], py: number[], noOverlapPad: readonly Rect[]): boolean {
  return !anyTrue(inAny(px, py, noOverlapPad));
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
  if (!boundsOk(px, py, width, decorTop, decorBottom, overflowFrac, s)) return false;
  if (!checkCommon(px, py, noOverlapPad)) return false;
  if (anyTrue(inAny(px, py, textPad))) return false;
  if (opaqueMode === 'hard') {
    if (anyTrue(inAny(px, py, opaque))) return false;
  } else {
    const bb = bboxOf(px, py);
    if (gutterCount(bb, opaque) >= 2) return false;
    const visible = inAny(px, py, opaque).map((v) => !v);
    if (meanTrue(visible) < 0.7) return false;
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
  if (!boundsOk(px, py, width, decorTop, decorBottom, 0.4, s)) return false;
  if (!checkCommon(px, py, noOverlapPad)) return false;
  if (textRaw.length > 0) {
    const ratio = meanTrue(inAny(px, py, textRaw));
    if (ratio > 0.25) return false;
  }
  const bb = bboxOf(px, py);
  if (gutterCount(bb, opaque) >= 2) return false;
  const opaqueHit = inAny(px, py, opaque);
  let visibleCount = 0;
  for (let i = 0; i < px.length; i++) {
    const onPage = px[i] >= 0 && px[i] <= width;
    if (onPage && !opaqueHit[i]) visibleCount++;
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
  if (!boundsOk(px, py, width, decorTop, decorBottom, 0.0, D)) return false;
  if (!checkCommon(px, py, noOverlapPad)) return false;
  if (textMode === 'hard') {
    if (anyTrue(inAny(px, py, textPad))) return false;
  } else {
    if (textRaw.length > 0) {
      const ratio = meanTrue(inAny(px, py, textRaw));
      if (ratio > 0.25) return false;
    }
  }
  if (opaqueMode === 'hard') {
    if (anyTrue(inAny(px, py, opaque))) return false;
  } else {
    const bb = bboxOf(px, py);
    if (gutterCount(bb, opaque) >= 2) return false;
    const visible = inAny(px, py, opaque).map((v) => !v);
    if (meanTrue(visible) < minVisible) return false;
  }
  return true;
}
