import {
  bboxRadius,
  collisionOk,
  infRadius,
  pad,
  sampleInfIfBounds,
  sampleShapeIfBounds,
  validInf,
  validL,
  validS,
} from './geometry';
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
  gap: readonly [number, number];
}

const RANGES: Record<Platform, RangeSet> = {
  pc: { L: [225, 400], S: [70, 120], D: [120, 175], gap: [520, 900] },
  sp: { L: [150, 250], S: [50, 80], D: [80, 115], gap: [420, 720] },
};

const GUTTER = 24;
const MAX_SHRINK = 15;

// --- 決定的乱数: place.py の Rng クラスと同一の引く順序 ---
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

export function placeBackgroundShapes(input: PlacementInput): PlacementResult {
  const { pathname, platform, width, height, decorTop, decorBottom } = input;
  const textRaw = input.text;
  const noOverlapRaw = input.noOverlap;
  const opaque = input.opaque;
  const textPad = pad(textRaw, 10);
  const noOverlapPad = pad(noOverlapRaw, 10);

  const R = RANGES[platform];
  const rng = new Rng(pathname);
  const shapes: WorkingShape[] = [];
  const placed: PlacedCircle[] = [];

  // ---- ∞ ----
  const countInf = Math.max(1, 1 + Math.floor((height - 2500) / 2500));
  let deficitInf = 0;
  const [dLo0, dHi0] = R.D;
  for (let n = 0; n < countInf; n++) {
    let ok = false;
    let shrink = 0;
    while (!ok && shrink < 40) {
      const dHi = Math.max(dLo0, dHi0 * 0.8 ** shrink);
      for (let t = 0; t < 600; t++) {
        const D = rng.uniform(dLo0, dHi);
        const c1 = rng.pick(TOKENS);
        const c2 = rng.pick(TOKENS.filter((c) => c !== c1));
        const rot = rng.uniform(-12, 12);
        const x = rng.uniform(0, width);
        const y = rng.uniform(decorTop, decorBottom);
        const sampled = sampleInfIfBounds(
          D,
          rot,
          x,
          y,
          width,
          decorTop,
          decorBottom,
        );
        if (sampled === null) continue;
        const { px, py } = sampled;
        const r = infRadius(D);
        if (
          !validInf(
            px,
            py,
            width,
            decorTop,
            decorBottom,
            noOverlapPad,
            textPad,
            opaque,
            D,
            'hard',
          )
        )
          continue;
        if (!collisionOk(x, y, r, placed, GUTTER)) continue;
        placed.push({ cx: x, cy: y, r });
        shapes.push({
          tier: 'Inf',
          kind: 'ring',
          cx: x,
          cy: y,
          size: D,
          rotation: rot,
          colors: [c1, c2],
          texture: null,
        });
        ok = true;
        break;
      }
      shrink++;
    }
    if (!ok) {
      // 最終緩和2: L で承認済みの「カードの裏に回す」手法(可視率0.6→0.25、
      // ガター禁止・はみ出し禁止は維持)を∞にも適用する最小限の追加段。
      // サイズは下限固定 (これ以上縮めない)、位置のみ広く再探索する。
      const D = dLo0;
      for (let t = 0; t < 6000; t++) {
        const c1 = rng.pick(TOKENS);
        const c2 = rng.pick(TOKENS.filter((c) => c !== c1));
        const rot = rng.uniform(-12, 12);
        const x = rng.uniform(0, width);
        const y = rng.uniform(decorTop, decorBottom);
        const sampled = sampleInfIfBounds(
          D,
          rot,
          x,
          y,
          width,
          decorTop,
          decorBottom,
        );
        if (sampled === null) continue;
        const { px, py } = sampled;
        const r = infRadius(D);
        if (
          !validInf(
            px,
            py,
            width,
            decorTop,
            decorBottom,
            noOverlapPad,
            textPad,
            opaque,
            D,
            'soft',
            0.25,
          )
        )
          continue;
        if (!collisionOk(x, y, r, placed, GUTTER)) continue;
        placed.push({ cx: x, cy: y, r });
        shapes.push({
          tier: 'Inf',
          kind: 'ring',
          cx: x,
          cy: y,
          size: D,
          rotation: rot,
          colors: [c1, c2],
          texture: null,
        });
        ok = true;
        break;
      }
    }
    if (!ok) {
      // 最終緩和3: L と同じ基準(黒文字との重なり面積比25%以下)で∞にも文字との
      // 重なりを許す。opaque の扱いは 'hard' のまま据え置き、段2とは独立 (組み合わせない)。
      const D = dLo0;
      for (let t = 0; t < 6000; t++) {
        const c1 = rng.pick(TOKENS);
        const c2 = rng.pick(TOKENS.filter((c) => c !== c1));
        const rot = rng.uniform(-12, 12);
        const x = rng.uniform(0, width);
        const y = rng.uniform(decorTop, decorBottom);
        const sampled = sampleInfIfBounds(
          D,
          rot,
          x,
          y,
          width,
          decorTop,
          decorBottom,
        );
        if (sampled === null) continue;
        const { px, py } = sampled;
        const r = infRadius(D);
        if (
          !validInf(
            px,
            py,
            width,
            decorTop,
            decorBottom,
            noOverlapPad,
            textPad,
            opaque,
            D,
            'hard',
            1.0,
            'ratio25',
            textRaw,
          )
        )
          continue;
        if (!collisionOk(x, y, r, placed, GUTTER)) continue;
        placed.push({ cx: x, cy: y, r });
        shapes.push({
          tier: 'Inf',
          kind: 'ring',
          cx: x,
          cy: y,
          size: D,
          rotation: rot,
          colors: [c1, c2],
          texture: null,
        });
        ok = true;
        break;
      }
    }
    if (!ok) deficitInf++;
  }

  // ---- L ----
  const [lLo, lHi] = R.L;
  const [gapLo, gapHi] = R.gap;
  const lSlots: WorkingShape[] = [];
  let yPrev: number | null = null;
  let deficitL = 0;

  interface LDraw {
    kind: ShapeKind;
    s: number;
    rot: number;
    cx: number;
    cy: number;
  }

  function drawAndTryL(
    y: number,
    sRange: readonly [number, number],
    minVisible: number,
  ): LDraw | null {
    const kind = rng.pick(KINDS);
    const s = rng.uniform(sRange[0], sRange[1]);
    const rot = rng.randint(360);
    const x = rng.uniform(-0.4 * s, width + 0.4 * s);
    const sampled = sampleShapeIfBounds(
      kind,
      s,
      rot,
      x,
      y,
      width,
      decorTop,
      decorBottom,
      0.4,
    );
    if (sampled === null) return null;
    const { px, py } = sampled;
    if (
      validL(
        px,
        py,
        width,
        decorTop,
        decorBottom,
        noOverlapPad,
        textRaw,
        opaque,
        s,
        minVisible,
      ) &&
      collisionOk(x, y, bboxRadius(s), placed, GUTTER)
    ) {
      return { kind, s, rot, cx: x, cy: y };
    }
    return null;
  }

  function searchL(y0: number, gap: number, minVisible: number): LDraw | null {
    let result: LDraw | null = null;
    let k = 0;
    while (result === null && k < MAX_SHRINK) {
      const curHi = Math.max(lLo, lHi * 0.85 ** k);
      const sRange: [number, number] = [lLo, curHi];
      for (let t = 0; t < 200; t++) {
        result = drawAndTryL(y0, sRange, minVisible);
        if (result) break;
      }
      if (result === null) {
        for (let t = 0; t < 200; t++) {
          let yJ = y0 + rng.uniform(-gap / 4, gap / 4);
          yJ = Math.min(Math.max(yJ, decorTop), decorBottom);
          result = drawAndTryL(yJ, sRange, minVisible);
          if (result) break;
        }
      }
      k++;
    }
    return result;
  }

  while (true) {
    const gap = rng.uniform(gapLo, gapHi);
    const y0: number =
      yPrev === null ? decorTop + rng.uniform(0, gap) : yPrev + gap;
    if (y0 > decorBottom) break;

    // 通常の縦位置ずらし・縮小 (可視率下限0.6) で置けない場合の最終手段として、
    // カード等の不透明な面が本文列を埋めて置き場がない画面向けに、可視率下限を
    // 0.25 まで緩めてカードの裏に回す配置を許す (ガター禁止・はみ出し0.4は維持)
    let result = searchL(y0, gap, 0.6);
    if (result === null) result = searchL(y0, gap, 0.25);

    if (result) {
      const r = bboxRadius(result.s);
      placed.push({ cx: result.cx, cy: result.cy, r });
      const shape: WorkingShape = {
        tier: 'L',
        kind: result.kind,
        cx: result.cx,
        cy: result.cy,
        size: result.s,
        rotation: result.rot,
        colors: null,
        texture: null,
      };
      shapes.push(shape);
      yPrev = result.cy;
      lSlots.push(shape);
    } else {
      deficitL++;
      yPrev = y0;
    }
  }

  // L の下限は1個。装飾可能高が狭いページでは通常の歩行の最初の1歩でフッター上端を
  // 超え、L が1個も置けないことがある。その場合に限り、歩行の縦位置制約を外して
  // 装飾可能帯全域から縦位置を探し直す (制約・緩和順序は歩行時と同じ:
  // 縮小 → 可視率0.6→0.25、ガター禁止・はみ出し0.4は維持)。これがないと水彩は L
  // にしか割り当てないため4質感を満たせない画面が生まれる。
  if (lSlots.length === 0) {
    function drawAndTryAnywhere(
      sRange: readonly [number, number],
      minVisible: number,
    ): LDraw | null {
      const kind = rng.pick(KINDS);
      const s = rng.uniform(sRange[0], sRange[1]);
      const rot = rng.randint(360);
      const x = rng.uniform(-0.4 * s, width + 0.4 * s);
      const y = rng.uniform(decorTop, decorBottom);
      const sampled = sampleShapeIfBounds(
        kind,
        s,
        rot,
        x,
        y,
        width,
        decorTop,
        decorBottom,
        0.4,
      );
      if (sampled === null) return null;
      const { px, py } = sampled;
      if (
        validL(
          px,
          py,
          width,
          decorTop,
          decorBottom,
          noOverlapPad,
          textRaw,
          opaque,
          s,
          minVisible,
        ) &&
        collisionOk(x, y, bboxRadius(s), placed, GUTTER)
      ) {
        return { kind, s, rot, cx: x, cy: y };
      }
      return null;
    }

    function searchAnywhere(minVisible: number): LDraw | null {
      let k = 0;
      while (k < MAX_SHRINK) {
        const curHi = Math.max(lLo, lHi * 0.85 ** k);
        const sRange: [number, number] = [lLo, curHi];
        for (let t = 0; t < 200; t++) {
          const result = drawAndTryAnywhere(sRange, minVisible);
          if (result) return result;
        }
        k++;
      }
      return null;
    }

    const result = searchAnywhere(0.6) ?? searchAnywhere(0.25);
    if (result) {
      const r = bboxRadius(result.s);
      placed.push({ cx: result.cx, cy: result.cy, r });
      const shape: WorkingShape = {
        tier: 'L',
        kind: result.kind,
        cx: result.cx,
        cy: result.cy,
        size: result.s,
        rotation: result.rot,
        colors: null,
        texture: null,
      };
      shapes.push(shape);
      lSlots.push(shape);
      deficitL = 0;
    } else {
      deficitL = 1;
    }
  }

  // ---- 質感割当 (L): 配置と同じ乱数列の続き ----
  const countL = lSlots.length;
  const perm = rng.shuffle(TEX);
  if (countL > 0 && !perm.slice(0, countL).includes('watercolor')) {
    perm.splice(perm.indexOf('watercolor'), 1);
    perm.unshift('watercolor');
  }
  if (countL > 0) {
    const assigned = Array.from({ length: countL }, (_, i) =>
      i < 4 ? perm[i] : rng.pick(TEX),
    );
    lSlots.forEach((shp, i) => {
      shp.texture = rng.pick(L_TEX_FILES[assigned[i]]);
    });
  }

  // ---- S ----
  const [sLo, sHi] = R.S;
  const countS = Math.max(
    Math.floor((decorBottom - decorTop) / 400),
    4 - countL,
  );
  const sShapes: WorkingShape[] = [];

  function drawS(
    sRange: readonly [number, number],
    xOverflow: number,
  ): { kind: ShapeKind; s: number; rot: number; x: number; y: number } {
    const kind = rng.pick(KINDS);
    const s = rng.uniform(sRange[0], sRange[1]);
    const rot = rng.randint(360);
    const x = rng.uniform(-xOverflow * s, width + xOverflow * s);
    const y = rng.uniform(decorTop, decorBottom);
    return { kind, s, rot, x, y };
  }

  function attemptS(
    nAttempts: number,
    sRange: readonly [number, number],
    gap: number,
    xOverflow: number,
    opaqueMode: 'hard' | 'soft',
  ) {
    for (let t = 0; t < nAttempts; t++) {
      if (sShapes.length >= countS) break;
      const { kind, s, rot, x, y } = drawS(sRange, xOverflow);
      const sampled = sampleShapeIfBounds(
        kind,
        s,
        rot,
        x,
        y,
        width,
        decorTop,
        decorBottom,
        xOverflow,
      );
      if (sampled === null) continue;
      const { px, py } = sampled;
      if (
        !validS(
          px,
          py,
          width,
          decorTop,
          decorBottom,
          noOverlapPad,
          textPad,
          opaque,
          s,
          xOverflow,
          opaqueMode,
        )
      )
        continue;
      const r = bboxRadius(s);
      if (!collisionOk(x, y, r, placed, gap)) continue;
      placed.push({ cx: x, cy: y, r });
      sShapes.push({
        tier: 'S',
        kind,
        cx: x,
        cy: y,
        size: s,
        rotation: rot,
        colors: null,
        texture: null,
      });
    }
  }

  if (countS > 0) {
    attemptS(countS * 200, [sLo, sHi], GUTTER, 0.0, 'hard');
    let k = 1;
    while (sShapes.length < countS && k <= MAX_SHRINK) {
      const curHi = Math.max(sLo, sHi * 0.85 ** k);
      attemptS(200, [sLo, curHi], GUTTER, 0.0, 'hard');
      k++;
    }
    if (sShapes.length < countS) attemptS(200, [sLo, sLo], 12, 0.0, 'hard');
    if (sShapes.length < countS) attemptS(200, [sLo, sLo], 12, 0.5, 'soft');
  }

  const deficitS = Math.max(0, countS - sShapes.length);

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
    L: countL + deficitL,
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
