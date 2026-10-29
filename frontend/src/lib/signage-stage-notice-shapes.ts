import type {
  RingColor,
  ShapeKind,
  TextureId,
} from '@/lib/background-shapes/types';

export type NoticeShape =
  | {
      readonly kind: ShapeKind;
      readonly size: number;
      readonly rot: number;
      readonly cx: number;
      readonly cy: number;
      readonly texture: TextureId;
      readonly pos: readonly [number, number];
      readonly texRot: number;
    }
  | {
      readonly kind: 'ring';
      readonly diameter: number;
      readonly rot: number;
      readonly cx: number;
      readonly cy: number;
      readonly colors: readonly [RingColor, RingColor];
    };

/** メイン 1536×864 の座標。中心、回転は度(時計回り正) */
export const NOTICE_SHAPES: readonly NoticeShape[] = [
  {
    kind: 'square',
    size: 340,
    rot: 15,
    cx: 1450,
    cy: 120,
    texture: 'watercolor',
    pos: [0, 40],
    texRot: 30,
  },
  {
    kind: 'semicircle',
    size: 300,
    rot: -20,
    cx: 1380,
    cy: 800,
    texture: 'gradient',
    pos: [100, 50],
    texRot: 120,
  },
  {
    kind: 'ring',
    diameter: 160,
    rot: -8,
    cx: 1200,
    cy: 160,
    colors: ['ochre', 'salmon'],
  },
  {
    kind: 'circle',
    size: 90,
    rot: 0,
    cx: 90,
    cy: 60,
    texture: 'grain',
    pos: [40, 100],
    texRot: 200,
  },
  {
    kind: 'triangle',
    size: 100,
    rot: 20,
    cx: 60,
    cy: 820,
    texture: 'streak',
    pos: [100, 0],
    texRot: 60,
  },
  {
    kind: 'quarterCircle',
    size: 110,
    rot: 0,
    cx: 760,
    cy: 840,
    texture: 'grain',
    pos: [0, 40],
    texRot: 300,
  },
  {
    kind: 'roundedSquare',
    size: 80,
    rot: -15,
    cx: 1530,
    cy: 470,
    texture: 'gradient',
    pos: [40, 100],
    texRot: 90,
  },
  {
    kind: 'circle',
    size: 260,
    rot: 0,
    cx: 700,
    cy: 430,
    texture: 'streak',
    pos: [100, 50],
    texRot: 150,
  },
  {
    kind: 'square',
    size: 90,
    rot: 25,
    cx: 300,
    cy: 200,
    texture: 'watercolor',
    pos: [100, 0],
    texRot: 10,
  },
];

export const NOTICE_MAIN_CENTER = { x: 768, y: 432 } as const;

/** 一辺(直径)がこの値以下の図形は小さい図形として短く速く動く */
export const NOTICE_SMALL_SHAPE_MAX = 150;

export const NOTICE_MOTION = {
  enter: {
    small: { distancePx: 200, durationSec: 1.0 },
    large: { distancePx: 120, durationSec: 1.4 },
    easing: 'cubic-bezier(0.16, 0.84, 0.44, 1)',
    fadeSec: 0.6,
    ring: { splitPx: 120, rightDelaySec: 0.15 },
  },
  beat: {
    keyframes: { '0%': 1, '15%': 1.08, '100%': 1 },
    easing: 'ease-out',
    rotateBeats: 8,
  },
  leave: {
    textFadeSec: 0.3,
    distancePx: 1400,
    small: { durationSec: 0.6 },
    large: { durationSec: 0.8 },
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
    ringSplitPx: 160,
    backdrop: { delaySec: 0.5, durationSec: 0.4 },
    totalMs: 900,
  },
} as const;

export function noticeBpm(remainingSec: number): 100 | 120 | 140 {
  if (remainingSec > 60) return 100;
  if (remainingSec >= 30) return 120;
  return 140;
}

/** 壁時計に揃えた負の animation-delay(秒)。全端末で拍が揃う */
export function beatDelaySec(now: Date, bpm: number, beats = 1): number {
  const periodMs = (60000 / bpm) * beats;
  return -((now.getTime() % periodMs) / 1000);
}
