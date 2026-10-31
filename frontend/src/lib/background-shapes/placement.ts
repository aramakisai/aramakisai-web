import { bboxRadius, collisionOk, infRadius, shapeFits } from './geometry';
import {
  drawTexturePosition,
  drawTextureRotation,
  fnv1a,
  mulberry32,
} from './rng';
import type {
  Platform,
  PlacedShape,
  PlacementInput,
  PlacementResult,
  RingColor,
  ShapeKind,
  Tier,
  TextureId,
} from './types';

const TOKENS: readonly RingColor[] = [
  'ochre',
  'olive',
  'sage',
  'salmon',
  'rose',
  'wisteria',
  'aqua',
];
// 並びを変えると質感割当の乱数消費がずれる
const TEX: readonly TextureId[] = ['gradient', 'watercolor', 'grain', 'streak'];
// 水彩は小さいと汚れに見えるため S では使わない
const S_TEX: readonly TextureId[] = ['gradient', 'grain', 'streak'];
const KINDS: readonly ShapeKind[] = [
  'circle',
  'triangle',
  'square',
  'roundedSquare',
  'quarterCircle',
  'semicircle',
];

interface RangeSet {
  L: readonly [number, number];
  S: readonly [number, number];
  D: readonly [number, number];
}

const RANGES: Record<Platform, RangeSet> = {
  pc: { L: [225, 400], S: [70, 120], D: [120, 175] },
  sp: { L: [150, 250], S: [50, 80], D: [80, 115] },
};

// L の個数 = 装飾可能高をこの間隔で割った目安
const AVG_L_GAP: Record<Platform, number> = { pc: 546, sp: 438 };
const S_PITCH = 308;
const INF_PITCH = 1920;

const GUTTER = 24;
const SHRINK_FACTOR = 0.85;
const MAX_POSITION_TRIES = 100;

// --- 決定的乱数: 種は pathname (rng.ts の fnv1a → mulberry32) ---
class Rng {
  private readonly next: () => number;

  constructor(seedStr: string) {
    this.next = mulberry32(fnv1a(seedStr));
  }

  f(): number {
    return this.next();
  }

  uniform(lo: number, hi: number): number {
    return lo + this.f() * (hi - lo);
  }

  randint(n: number): number {
    return Math.floor(this.f() * n);
  }

  pick<T>(seq: readonly T[]): T {
    return seq[this.randint(seq.length)];
  }

  shuffle<T>(seq: readonly T[]): T[] {
    const a = [...seq];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.randint(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

interface PlacedCircle {
  cx: number;
  cy: number;
  r: number;
}

// Inf/L/S 共通の配置中の中間表現。texture/colors は tier ごとに後段で埋める。
interface WorkingShape {
  tier: Tier;
  kind: ShapeKind | 'ring';
  cx: number;
  cy: number;
  size: number;
  rotation: number;
  colors: readonly [RingColor, RingColor] | null;
  texture: TextureId | null;
  texturePos: readonly [number, number] | null;
  textureRot: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 各サイズで位置を最大 100 回試し、置けなければ一辺 (∞ は直径) を 0.85 倍して
 * 同じことを繰り返す。範囲の最小値でも置けなければ諦める (null)。
 */
function placeWithShrink(
  initialSize: number,
  sizeMin: number,
  radiusOf: (size: number) => number,
  tryPosition: (size: number, r: number) => PlacedCircle | null,
): (PlacedCircle & { size: number }) | null {
  let size = initialSize;
  for (;;) {
    const r = radiusOf(size);
    for (let t = 0; t < MAX_POSITION_TRIES; t++) {
      const found = tryPosition(size, r);
      if (found) return { ...found, size };
    }
    if (size <= sizeMin + 1e-9) return null;
    size = Math.max(sizeMin, size * SHRINK_FACTOR);
  }
}

export function placeBackgroundShapes(input: PlacementInput): PlacementResult {
  const { pathname, platform, width, height, decorTop, decorBottom } = input;
  const decorHeight = decorBottom - decorTop;

  const R = RANGES[platform];
  const rng = new Rng(pathname);
  const placed: PlacedCircle[] = [];
  const shapes: WorkingShape[] = [];

  // ---- ∞ ----
  const countInf = Math.max(
    1,
    1 + Math.floor((height - INF_PITCH) / INF_PITCH),
  );
  const [dLo, dHi] = R.D;
  let deficitInf = 0;
  for (let n = 0; n < countInf; n++) {
    const c1 = rng.pick(TOKENS);
    const c2 = rng.pick(TOKENS.filter((c) => c !== c1));
    const rot = rng.uniform(-12, 12);
    const initialD = rng.uniform(dLo, dHi);
    const found = placeWithShrink(initialD, dLo, infRadius, (size, r) => {
      const overflow = 0.4 * size;
      const cx = rng.uniform(-overflow, width + overflow);
      const cy = rng.uniform(decorTop, decorBottom);
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow))
        return null;
      if (!collisionOk(cx, cy, r, placed, GUTTER)) return null;
      return { cx, cy, r };
    });
    if (found) {
      placed.push({ cx: found.cx, cy: found.cy, r: found.r });
      shapes.push({
        tier: 'Inf',
        kind: 'ring',
        cx: found.cx,
        cy: found.cy,
        size: found.size,
        rotation: rot,
        colors: [c1, c2],
        texture: null,
        texturePos: null,
        textureRot: null,
      });
    } else {
      deficitInf++;
    }
  }

  // ---- L: 装飾範囲を L の個数で等分した区間の中で縦位置を引く ----
  const [lLo, lHi] = R.L;
  const countL = Math.max(1, Math.round(decorHeight / AVG_L_GAP[platform]));
  const segH = decorHeight / countL;
  const lSlots: WorkingShape[] = [];
  let deficitL = 0;
  for (let i = 0; i < countL; i++) {
    const segTop = decorTop + i * segH;
    const segBottom = decorTop + (i + 1) * segH;
    const kind = rng.pick(KINDS);
    const rot = rng.randint(360);
    const initialS = rng.uniform(lLo, lHi);
    const found = placeWithShrink(initialS, lLo, bboxRadius, (size, r) => {
      const overflow = 0.4 * size;
      const cx = rng.uniform(-overflow, width + overflow);
      const cy = rng.uniform(segTop, segBottom);
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow))
        return null;
      if (!collisionOk(cx, cy, r, placed, GUTTER)) return null;
      return { cx, cy, r };
    });
    if (found) {
      placed.push({ cx: found.cx, cy: found.cy, r: found.r });
      const shape: WorkingShape = {
        tier: 'L',
        kind,
        cx: found.cx,
        cy: found.cy,
        size: found.size,
        rotation: rot,
        colors: null,
        texture: null,
        texturePos: null,
        textureRot: null,
      };
      shapes.push(shape);
      lSlots.push(shape);
    } else {
      deficitL++;
    }
  }

  // ---- 質感割当 (L): 配置と同じ乱数列の続き ----
  const perm = rng.shuffle(TEX);
  if (
    lSlots.length > 0 &&
    !perm.slice(0, lSlots.length).includes('watercolor')
  ) {
    perm.splice(perm.indexOf('watercolor'), 1);
    perm.unshift('watercolor');
  }
  if (lSlots.length > 0) {
    const assigned = Array.from({ length: lSlots.length }, (_, i) =>
      i < 4 ? perm[i] : rng.pick(TEX),
    );
    lSlots.forEach((shp, i) => {
      shp.texture = assigned[i];
    });
    lSlots.forEach((shp) => {
      shp.texturePos = drawTexturePosition(() => rng.f());
      shp.textureRot = drawTextureRotation(() => rng.f());
    });
  }

  // ---- S: 装飾範囲全体で縦位置を引く ----
  const [sLo, sHi] = R.S;
  const countS = Math.max(Math.floor(decorHeight / S_PITCH), 5 - countL);
  const sShapes: WorkingShape[] = [];
  for (let i = 0; i < countS; i++) {
    const kind = rng.pick(KINDS);
    const rot = rng.randint(360);
    const initialS = rng.uniform(sLo, sHi);
    const found = placeWithShrink(initialS, sLo, bboxRadius, (size, r) => {
      const overflow = 0.4 * size;
      const cx = rng.uniform(-overflow, width + overflow);
      const cy = rng.uniform(decorTop, decorBottom);
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow))
        return null;
      if (!collisionOk(cx, cy, r, placed, GUTTER)) return null;
      return { cx, cy, r };
    });
    if (found) {
      placed.push({ cx: found.cx, cy: found.cy, r: found.r });
      sShapes.push({
        tier: 'S',
        kind,
        cx: found.cx,
        cy: found.cy,
        size: found.size,
        rotation: rot,
        colors: null,
        texture: null,
        texturePos: null,
        textureRot: null,
      });
    }
  }
  const deficitS = countS - sShapes.length;

  // ---- 質感割当 (S): L で使われなかった質感 (水彩以外) を先頭から、残りは3質感から乱数 ----
  if (sShapes.length > 0) {
    const used = lSlots.map((shp) => shp.texture);
    const unused = perm.filter((t) => t !== 'watercolor' && !used.includes(t));
    sShapes.forEach((shp, i) => {
      shp.texture = i < unused.length ? unused[i] : rng.pick(S_TEX);
    });
    sShapes.forEach((shp) => {
      shp.texturePos = drawTexturePosition(() => rng.f());
      shp.textureRot = drawTextureRotation(() => rng.f());
    });
  }

  shapes.push(...sShapes);

  const target: Record<Tier, number> = {
    Inf: countInf,
    L: countL,
    S: countS,
  };
  const deficit: Record<Tier, number> = {
    Inf: deficitInf,
    L: deficitL,
    S: deficitS,
  };

  const resultShapes: PlacedShape[] = shapes.map((shp) => {
    const cx = round2(shp.cx);
    const cy = round2(shp.cy);
    const size = round2(shp.size);
    const rot = round2(shp.rotation);
    if (shp.tier === 'Inf') {
      return {
        tier: 'Inf',
        kind: 'ring',
        size,
        cx,
        cy,
        rot,
        texture: null,
        texturePos: null,
        textureRot: null,
        colors: shp.colors!,
      };
    }
    return {
      tier: shp.tier,
      kind: shp.kind as ShapeKind,
      size,
      cx,
      cy,
      rot,
      texture: shp.texture!,
      texturePos: shp.texturePos!,
      textureRot: shp.textureRot!,
      colors: null,
    };
  });

  return { shapes: resultShapes, target, deficit };
}

/**
 * 装飾範囲が下へ伸びたとき、既存の図形 (非表示中のものも含む) は動かさず、
 * [coveredBottom, decorBottom] にだけ同じ手順で図形を追加する。個数は伸びた後の
 * 装飾可能高で求めた目安から既存の同種の個数を引いた数。∞ の下限 1 は適用しない。
 * 種を coveredBottom にも依存させるのは、伸びるたびに同じ乱数列を繰り返さないため。
 */
export function extendBackgroundShapes(
  input: PlacementInput,
  existing: readonly PlacedShape[],
  coveredBottom: number,
): PlacedShape[] {
  const { pathname, platform, width, height, decorTop, decorBottom } = input;
  const decorHeight = decorBottom - decorTop;
  const R = RANGES[platform];
  const rng = new Rng(`${pathname}#${coveredBottom}`);

  const placed: PlacedCircle[] = existing.map((s) => ({
    cx: s.cx,
    cy: s.cy,
    r: s.tier === 'Inf' ? infRadius(s.size) : bboxRadius(s.size),
  }));
  const countOf = (tier: Tier) =>
    existing.filter((s) => s.tier === tier).length;

  const targetL = Math.max(1, Math.round(decorHeight / AVG_L_GAP[platform]));
  const addInf = Math.max(0, Math.floor(height / INF_PITCH) - countOf('Inf'));
  const addL = Math.max(0, targetL - countOf('L'));
  const addS = Math.max(
    0,
    Math.max(Math.floor(decorHeight / S_PITCH), 5 - targetL) - countOf('S'),
  );

  const place = (
    initial: number,
    sizeMin: number,
    radiusOf: (size: number) => number,
    cyLo: number,
    cyHi: number,
  ) =>
    placeWithShrink(initial, sizeMin, radiusOf, (size, r) => {
      const overflow = 0.4 * size;
      const cx = rng.uniform(-overflow, width + overflow);
      const cy = rng.uniform(cyLo, cyHi);
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow))
        return null;
      if (!collisionOk(cx, cy, r, placed, GUTTER)) return null;
      return { cx, cy, r };
    });

  const out: PlacedShape[] = [];
  const solid = (
    tier: 'L' | 'S',
    kind: ShapeKind,
    rot: number,
    found: PlacedCircle & { size: number },
    textures: readonly TextureId[],
  ) => {
    placed.push({ cx: found.cx, cy: found.cy, r: found.r });
    const texture = rng.pick(textures);
    out.push({
      tier,
      kind,
      size: round2(found.size),
      cx: round2(found.cx),
      cy: round2(found.cy),
      rot: round2(rot),
      texture,
      texturePos: drawTexturePosition(() => rng.f()),
      textureRot: drawTextureRotation(() => rng.f()),
      colors: null,
    });
  };

  for (let n = 0; n < addInf; n++) {
    const c1 = rng.pick(TOKENS);
    const c2 = rng.pick(TOKENS.filter((c) => c !== c1));
    const rot = rng.uniform(-12, 12);
    const found = place(
      rng.uniform(...R.D),
      R.D[0],
      infRadius,
      coveredBottom,
      decorBottom,
    );
    if (!found) continue;
    placed.push({ cx: found.cx, cy: found.cy, r: found.r });
    out.push({
      tier: 'Inf',
      kind: 'ring',
      size: round2(found.size),
      cx: round2(found.cx),
      cy: round2(found.cy),
      rot: round2(rot),
      texture: null,
      texturePos: null,
      textureRot: null,
      colors: [c1, c2],
    });
  }

  const segH = (decorBottom - coveredBottom) / Math.max(addL, 1);
  for (let i = 0; i < addL; i++) {
    const kind = rng.pick(KINDS);
    const rot = rng.randint(360);
    const found = place(
      rng.uniform(...R.L),
      R.L[0],
      bboxRadius,
      coveredBottom + i * segH,
      coveredBottom + (i + 1) * segH,
    );
    if (found) solid('L', kind, rot, found, TEX);
  }

  for (let i = 0; i < addS; i++) {
    const kind = rng.pick(KINDS);
    const rot = rng.randint(360);
    const found = place(
      rng.uniform(...R.S),
      R.S[0],
      bboxRadius,
      coveredBottom,
      decorBottom,
    );
    if (found) solid('S', kind, rot, found, S_TEX);
  }

  return out;
}
