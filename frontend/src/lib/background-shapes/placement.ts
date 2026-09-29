import { bboxRadius, collisionOk, infRadius, shapeFits } from './geometry';
import { fnv1a, mulberry32 } from './rng';
import type {
  Platform,
  PlacedShape,
  PlacementInput,
  PlacementResult,
  RingColor,
  ShapeKind,
  Tier,
  TextureFamily,
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
const TEX: readonly TextureFamily[] = [
  'gradient',
  'watercolor',
  'grainy',
  'halftone',
];
const KINDS: readonly ShapeKind[] = [
  'circle',
  'triangle',
  'square',
  'roundedSquare',
  'quarterCircle',
  'semicircle',
];

// tex5 のファイル名接頭辞と質感名の対応 (同じ質感の2枚から乱数で選ぶ)
const L_TEX_FILES: Record<TextureFamily, readonly TextureId[]> = {
  gradient: ['L1', 'L5'],
  watercolor: ['L2', 'L6'],
  grainy: ['L3', 'L7'],
  halftone: ['L4', 'L8'],
};
const S_TEX_FILES: Record<
  Exclude<TextureFamily, 'watercolor'>,
  readonly TextureId[]
> = {
  gradient: ['S1', 'S4'],
  grainy: ['S2', 'S5'],
  halftone: ['S3', 'S6'],
};

interface RangeSet {
  L: readonly [number, number];
  S: readonly [number, number];
  D: readonly [number, number];
}

const RANGES: Record<Platform, RangeSet> = {
  pc: { L: [225, 400], S: [70, 120], D: [120, 175] },
  sp: { L: [150, 250], S: [50, 80], D: [80, 115] },
};

// rules.md「L の縦位置」の間隔範囲 (PC 520〜900 / SP 420〜720) の平均。
// L の個数 = 装飾可能高をこの間隔で割った目安
const AVG_L_GAP: Record<Platform, number> = { pc: 710, sp: 570 };

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
  const opaque = input.opaque;
  const decorHeight = decorBottom - decorTop;

  const R = RANGES[platform];
  const rng = new Rng(pathname);
  const placed: PlacedCircle[] = [];
  const shapes: WorkingShape[] = [];

  // ---- ∞ ----
  const countInf = Math.max(1, 1 + Math.floor((height - 2500) / 2500));
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
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow, opaque))
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
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow, opaque))
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
      shp.texture = rng.pick(L_TEX_FILES[assigned[i]]);
    });
  }

  // ---- S: 装飾範囲全体で縦位置を引く ----
  const [sLo, sHi] = R.S;
  const countS = Math.max(Math.floor(decorHeight / 400), 4 - countL);
  const sShapes: WorkingShape[] = [];
  for (let i = 0; i < countS; i++) {
    const kind = rng.pick(KINDS);
    const rot = rng.randint(360);
    const initialS = rng.uniform(sLo, sHi);
    const found = placeWithShrink(initialS, sLo, bboxRadius, (size, r) => {
      const overflow = 0.4 * size;
      const cx = rng.uniform(-overflow, width + overflow);
      const cy = rng.uniform(decorTop, decorBottom);
      if (!shapeFits(cx, cy, r, width, decorTop, decorBottom, overflow, opaque))
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
      });
    }
  }
  const deficitS = countS - sShapes.length;

  // ---- 質感割当 (S): L で使われなかった質感 (水彩以外) を先頭から、残りは3質感から乱数 ----
  if (sShapes.length > 0) {
    const lTexNames: TextureFamily[] = [];
    for (const shp of lSlots) {
      for (const [name, files] of Object.entries(L_TEX_FILES) as [
        TextureFamily,
        readonly TextureId[],
      ][]) {
        if (shp.texture !== null && files.includes(shp.texture)) {
          lTexNames.push(name);
          break;
        }
      }
    }
    const unused = perm.filter(
      (t): t is Exclude<TextureFamily, 'watercolor'> =>
        t !== 'watercolor' && !lTexNames.includes(t),
    );
    const sTexOrder = Object.keys(S_TEX_FILES) as (keyof typeof S_TEX_FILES)[];
    sShapes.forEach((shp, i) => {
      const name = i < unused.length ? unused[i] : rng.pick(sTexOrder);
      shp.texture = rng.pick(S_TEX_FILES[name]);
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
      colors: null,
    };
  });

  return { shapes: resultShapes, target, deficit };
}
