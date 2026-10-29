import { describe, expect, it } from 'vitest';
import { buildMarqueeBlocks } from './sponsor-marquee';
import type { SponsorListItem } from './sponsors';

const sp = (
  id: number,
  tier: string | null,
  logo: string | null = `l${id}`,
): SponsorListItem => ({ id, name: `s${id}`, logoId: logo, url: null, tier });

const ids = (b: ReturnType<typeof buildMarqueeBlocks>[number]) =>
  b.columns.map((c) => c.map((s) => s.id));

describe('buildMarqueeBlocks', () => {
  it('A→B→C→D の順にブロック化し、取得順を保つ', () => {
    const blocks = buildMarqueeBlocks([
      sp(1, 'planD', null),
      sp(2, 'planC'),
      sp(3, 'planB'),
      sp(4, 'planA'),
    ]);
    expect(blocks.map((b) => b.tier)).toEqual([
      'planA',
      'planB',
      'planC',
      'planD',
    ]);
  });

  it('列あたり A=2 / B=3 / C=4 / D=5 件で上から詰める', () => {
    const mk = (tier: string, n: number, base: number) =>
      Array.from({ length: n }, (_, i) =>
        sp(base + i, tier, tier === 'planD' ? null : undefined),
      );
    const blocks = buildMarqueeBlocks([
      ...mk('planA', 3, 10),
      ...mk('planB', 4, 20),
      ...mk('planC', 5, 30),
      ...mk('planD', 6, 40),
    ]);
    expect(ids(blocks[0])).toEqual([[10, 11], [12]]);
    expect(ids(blocks[1])).toEqual([[20, 21, 22], [23]]);
    expect(ids(blocks[2])).toEqual([[30, 31, 32, 33], [34]]);
    expect(ids(blocks[3])).toEqual([[40, 41, 42, 43, 44], [45]]);
  });

  it('A〜C でもロゴが無い協賛・tier 未設定は D に回す', () => {
    const blocks = buildMarqueeBlocks([sp(1, 'planA', null), sp(2, null)]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].tier).toBe('planD');
    expect(ids(blocks[0])).toEqual([[1, 2]]);
  });

  it('0 件なら空', () => {
    expect(buildMarqueeBlocks([])).toEqual([]);
  });
});
