import type { SponsorListItem } from './sponsors';

export type MarqueeTier = 'planA' | 'planB' | 'planC' | 'planD';

export interface MarqueeBlock {
  readonly tier: MarqueeTier;
  /** 左から並べる縦の列。各列は上から詰める */
  readonly columns: readonly (readonly SponsorListItem[])[];
}

/** 1 列あたりの件数。D は社名の行 */
export const MARQUEE_COLUMN_SIZE: Readonly<Record<MarqueeTier, number>> = {
  planA: 2,
  planB: 2,
  planC: 3,
  planD: 4,
};

const LOGO_TIERS = ['planA', 'planB', 'planC'] as const;

/**
 * A→B→C→D のブロックに分ける。空のブロックは作らない。
 * A〜C はロゴが無くても自プランに置く (表示側が社名で代替し、プランの大きさ序列を保つ)。tier 未設定は D。
 */
export function buildMarqueeBlocks(
  sponsors: readonly SponsorListItem[],
): MarqueeBlock[] {
  const groups: Record<MarqueeTier, SponsorListItem[]> = {
    planA: [],
    planB: [],
    planC: [],
    planD: [],
  };
  for (const s of sponsors) {
    const tier = LOGO_TIERS.find((t) => t === s.tier);
    groups[tier ?? 'planD'].push(s);
  }
  return (['planA', 'planB', 'planC', 'planD'] as const)
    .filter((tier) => groups[tier].length > 0)
    .map((tier) => {
      const size = MARQUEE_COLUMN_SIZE[tier];
      const columns: SponsorListItem[][] = [];
      for (let i = 0; i < groups[tier].length; i += size) {
        columns.push(groups[tier].slice(i, i + size));
      }
      return { tier, columns };
    });
}
