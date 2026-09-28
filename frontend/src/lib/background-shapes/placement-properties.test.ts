import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { bboxRadius, infRadius, sampleInf } from './geometry';
import { placeBackgroundShapes } from './placement';
import type {
  PlacedShape,
  PlacementInput,
  PlacementResult,
  TextureFamily,
} from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');
const FIXTURE_NAMES = [
  'top-pc',
  'top-sp',
  'news-list-sp',
  'news-list-empty-sp',
  'topics-list-sp',
  'news-detail-sp',
  'news-detail-pc',
];

function loadFixture(name: string): PlacementInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'),
  ) as PlacementInput;
}

// 以下の性質は同じ fixture 入力に対して置換不変 (place.py の selftest 群を
// そのまま移植したもの) なので、fixture ごとに1回だけ配置計算して使い回す。
// news-list-sp 等は ∞ の緩和段で数千回再試行するため、性質の数だけ計算し直すと
// テスト実行時間が線形に伸びる。
const placed = new Map<
  string,
  { input: PlacementInput; result: PlacementResult }
>();

beforeAll(() => {
  for (const name of FIXTURE_NAMES) {
    const input = loadFixture(name);
    placed.set(name, { input, result: placeBackgroundShapes(input) });
  }
});

function radiusOf(shape: PlacedShape): number {
  return shape.tier === 'Inf' ? infRadius(shape.size) : bboxRadius(shape.size);
}

// place.py の selftest / selftest_short_page が検査する性質を、複数の pathname と PC/SP の
// fixture (top/news-list/news-list-empty/topics-list/news-detail の pc/sp) で確認する。
describe('placeBackgroundShapes: place.py の selftest と同じ性質', () => {
  // news-list-sp 等は ∞ の緩和段で最大 6000 回再試行するため既定の 5s を超えることがある。
  const SLOW_FIXTURE_TIMEOUT = 20000;

  it.each(FIXTURE_NAMES)(
    '%s: 図形同士の回転外接円は 24px 以上離れる',
    (name) => {
      const { result } = placed.get(name)!;
      const shapes = result.shapes;
      for (let i = 0; i < shapes.length; i++) {
        for (let j = i + 1; j < shapes.length; j++) {
          const a = shapes[i];
          const b = shapes[j];
          const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
          expect(d).toBeGreaterThanOrEqual(
            radiusOf(a) + radiusOf(b) + 24 - 1e-6,
          );
        }
      }
    },
    SLOW_FIXTURE_TIMEOUT,
  );

  it.each(FIXTURE_NAMES)(
    '%s: L が1つでも置ければ1ページで4質感すべてを使う',
    (name) => {
      // 水彩は L にしか割り当てられない (S_TEX_FILES に watercolor が無い) ため、
      // 4質感の網羅は L が最低1つ置け、かつ S が不足なく目標数どおり置けたときだけ
      // 保証される (place.py の meta.texture_coverage_ok と同じ条件。装飾可能高が
      // 極端に狭く S が deficit になるページでは網羅が崩れうる。これは place.py 側
      // でも同じで、golden の texture_coverage_ok: false がそれを記録している)。
      const { result } = placed.get(name)!;
      const lOrS = result.shapes.filter(
        (s): s is Extract<PlacedShape, { tier: 'L' | 'S' }> =>
          s.tier === 'L' || s.tier === 'S',
      );
      const hasL = result.shapes.some((s) => s.tier === 'L');
      if (!hasL || result.deficit.S > 0) return;
      const used = new Set<TextureFamily>();
      for (const shape of lOrS) {
        if (shape.texture.startsWith('L')) {
          if (['L1', 'L5'].includes(shape.texture)) used.add('gradient');
          else if (['L2', 'L6'].includes(shape.texture)) used.add('watercolor');
          else if (['L3', 'L7'].includes(shape.texture)) used.add('grainy');
          else used.add('halftone');
        } else {
          if (['S1', 'S4'].includes(shape.texture)) used.add('gradient');
          else if (['S2', 'S5'].includes(shape.texture)) used.add('grainy');
          else used.add('halftone');
        }
      }
      expect(used).toEqual(
        new Set<TextureFamily>([
          'gradient',
          'watercolor',
          'grainy',
          'halftone',
        ]),
      );
    },
    SLOW_FIXTURE_TIMEOUT,
  );

  it.each(FIXTURE_NAMES)(
    '%s: ∞ の個数は 1 + floor((height - 2500) / 2500) (下限1)',
    (name) => {
      const { input, result } = placed.get(name)!;
      const expected = Math.max(
        1,
        1 + Math.floor((input.height - 2500) / 2500),
      );
      expect(result.target.Inf).toBe(expected);
    },
    SLOW_FIXTURE_TIMEOUT,
  );

  it.each(FIXTURE_NAMES)(
    '%s: S の個数は max(floor(装飾可能高/400), 4 - L の個数)',
    (name) => {
      const { input, result } = placed.get(name)!;
      const placedL = result.shapes.filter((s) => s.tier === 'L').length;
      const expected = Math.max(
        Math.floor((input.decorBottom - input.decorTop) / 400),
        4 - placedL,
      );
      expect(result.target.S).toBe(expected);
    },
    SLOW_FIXTURE_TIMEOUT,
  );

  it.each(FIXTURE_NAMES)(
    '%s: ∞ はページ端からはみ出さない (overflow 0)',
    (name) => {
      const { input, result } = placed.get(name)!;
      for (const shape of result.shapes) {
        if (shape.tier !== 'Inf') continue;
        const { px } = sampleInf(shape.size, shape.rot, shape.cx, shape.cy);
        expect(Math.min(...px)).toBeGreaterThanOrEqual(-1e-6);
        expect(Math.max(...px)).toBeLessThanOrEqual(input.width + 1e-6);
      }
    },
    SLOW_FIXTURE_TIMEOUT,
  );

  // place.py の selftest_l_minimum_one と同じ回帰: 装飾可能高が極端に狭く、通常の
  // 縦位置の歩行では最初の一歩でフッター上端を超えてしまう画面でも、L の個数は
  // 1以上になる (装飾可能帯全域からの探し直し救済)。
  it.each([
    {
      platform: 'pc' as const,
      width: 1440,
      decorTop: 200,
      decorBottom: 200 + 454,
    },
    {
      platform: 'sp' as const,
      width: 390,
      decorTop: 150,
      decorBottom: 150 + 335,
    },
  ])(
    '$platform: 装飾可能高が狭いページでも L は1以上置かれる',
    ({ platform, width, decorTop, decorBottom }) => {
      const input: PlacementInput = {
        pathname: '/error',
        platform,
        width,
        height: decorBottom + 300,
        decorTop,
        decorBottom,
        text: [
          { x: width / 2 - 100, y: decorTop + 40, w: 200, h: 40 },
          { x: width / 2 - 60, y: decorTop + 100, w: 120, h: 24 },
        ],
        noOverlap: [],
        opaque: [],
      };
      const result = placeBackgroundShapes(input);
      const placedL = result.shapes.filter((s) => s.tier === 'L').length;
      expect(placedL).toBeGreaterThanOrEqual(1);
      expect(result.deficit).toEqual({ Inf: 0, L: 0, S: 0 });
      for (const shape of result.shapes) {
        if (shape.tier !== 'L') continue;
        expect(shape.cy).toBeGreaterThanOrEqual(decorTop - 1e-6);
        expect(shape.cy).toBeLessThanOrEqual(decorBottom + 1e-6);
      }
    },
    SLOW_FIXTURE_TIMEOUT,
  );
});
