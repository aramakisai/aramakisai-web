import type { CSSProperties } from 'react';
import { InfRing, ShapeFill } from '@/components/background-shapes';
import { bboxRadius, infRadius } from '@/lib/background-shapes/geometry';
import {
  drawTexturePosition,
  drawTextureRotation,
  fnv1a,
  mulberry32,
} from '@/lib/background-shapes/rng';
import type { ShapeKind, TextureId } from '@/lib/background-shapes/types';
import { CANVAS_SIZE, type SignageOrientation } from '@/lib/signage';

type Tier = 'L' | 'S' | 'Inf';

interface BubbleSpec {
  readonly tier: Tier;
  readonly kind: ShapeKind | 'ring';
  readonly size: number;
  /** Figma のノード回転 (反時計回りが正)。CSS では符号を反転して使う */
  readonly rot: number;
  readonly cx: number;
  /** t=0 時点で 1 周のうち既に上がっている割合 */
  readonly phase: number;
  readonly texture?: TextureId;
}

const b = (
  tier: Tier,
  kind: BubbleSpec['kind'],
  size: number,
  rot: number,
  cx: number,
  phase: number,
  texture?: TextureId,
): BubbleSpec => ({ tier, kind, size, rot, cx, phase, texture });

const SPECS: Record<SignageOrientation, readonly BubbleSpec[]> = {
  landscape: [
    b('L', 'square', 315, 104, 1500, 0.3, 'watercolor'),
    b('L', 'roundedSquare', 229, -179, 520, 0.72, 'gradient'),
    b('Inf', 'ring', 171.5, -10.5, 1000, 0.5),
    b('S', 'triangle', 85, -23, 150, 0.15, 'streak'),
    b('S', 'circle', 80, -74, 1750, 0.88, 'gradient'),
    b('S', 'quarterCircle', 94, -105, 760, 0.35, 'grain'),
    b('L', 'square', 225, 90, 180, 0.45, 'streak'),
    b('S', 'roundedSquare', 102, -114, 90, 0.8, 'streak'),
    b('S', 'semicircle', 88.6, -38, 280, 0.1, 'grain'),
  ],
  portrait: [
    b('L', 'roundedSquare', 228.7, -179, 280, 0.05, 'gradient'),
    b('L', 'semicircle', 379.5, 14, 900, 0.29, 'watercolor'),
    b('L', 'square', 225, 90, 500, 0.57, 'streak'),
    b('L', 'square', 314.6, 104, 1000, 0.8, 'watercolor'),
    b('S', 'triangle', 85.2, -23, 60, 0.08, 'streak'),
    b('S', 'roundedSquare', 101.9, -114, 580, 0.25, 'streak'),
    b('S', 'circle', 79.7, -74, 1020, 0.42, 'gradient'),
    b('S', 'quarterCircle', 94.5, -105, 250, 0.58, 'grain'),
    b('S', 'square', 83, -102, 720, 0.75, 'gradient'),
    b('S', 'semicircle', 88.6, -38, 30, 0.92, 'grain'),
    b('Inf', 'ring', 171.5, -10.5, 560, 0.4),
  ],
};

// 縦型は横型の倍の所要時間 (画面の高さが約 1.8 倍あり、上昇速度を揃えるため)
const RISE_S: Record<SignageOrientation, Record<Tier, number>> = {
  landscape: { S: 40, Inf: 60, L: 80 },
  portrait: { S: 80, Inf: 120, L: 160 },
};
const SWAY: Record<Tier, { amplitude: number; period: number }> = {
  S: { amplitude: 24, period: 6 },
  Inf: { amplitude: 16, period: 8 },
  L: { amplitude: 12, period: 10 },
};

const TEXTURE_POS = Object.fromEntries(
  (Object.keys(SPECS) as SignageOrientation[]).map((o) => [
    o,
    SPECS[o].map((_, i) => {
      const rng = mulberry32(fnv1a(`/signage:${o}:${i}`));
      const pos = drawTexturePosition(rng);
      return { pos, rot: drawTextureRotation(rng) };
    }),
  ]),
) as Record<SignageOrientation, { pos: [number, number]; rot: number }[]>;

export function SignageBubbles({
  orientation,
}: {
  readonly orientation: SignageOrientation;
}) {
  const height = CANVAS_SIZE[orientation].height;
  return (
    <div
      aria-hidden
      data-signage-bubbles=""
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {SPECS[orientation].map((spec, i) => {
        const isInf = spec.tier === 'Inf';
        const w = isInf ? 1.74 * spec.size : spec.size;
        const h = spec.size;
        const r = isInf ? infRadius(spec.size) : bboxRadius(spec.size);
        const duration = RISE_S[orientation][spec.tier];
        const { amplitude, period } = SWAY[spec.tier];
        const tex = TEXTURE_POS[orientation][i];
        return (
          <div
            key={i}
            data-bubble=""
            className="absolute top-0"
            style={
              {
                left: spec.cx - r,
                width: 2 * r,
                height: 2 * r,
                '--rise-from': `${height}px`,
                '--rise-to': `${-2 * r}px`,
                animation: `bubble-rise ${duration}s linear ${-spec.phase * duration}s infinite`,
                willChange: 'transform',
              } as CSSProperties
            }
          >
            <div
              className="size-full"
              style={
                {
                  '--sway': `${amplitude}px`,
                  animation: `bubble-sway ${period}s ease-in-out ${i % 2 === 0 ? -period / 2 : 0}s infinite`,
                } as CSSProperties
              }
            >
              <div
                className="absolute"
                style={{
                  left: r - w / 2,
                  top: r - h / 2,
                  width: w,
                  height: h,
                  transform: `rotate(${-spec.rot}deg)`,
                }}
              >
                {isInf ? (
                  <>
                    <InfRing index={0} diameter={spec.size} color="ochre" />
                    <InfRing index={1} diameter={spec.size} color="wisteria" />
                  </>
                ) : (
                  <ShapeFill
                    kind={spec.kind as ShapeKind}
                    texture={spec.texture as TextureId}
                    pos={tex.pos}
                    rot={tex.rot}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
