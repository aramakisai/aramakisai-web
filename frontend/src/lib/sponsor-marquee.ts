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
  planB: 3,
  planC: 4,
  planD: 5,
};

const LOGO_TIERS = ['planA', 'planB', 'planC'] as const;

/** A→B→C→D のブロックに分ける。A〜C でもロゴが無い協賛は D (社名) に回す。空のブロックは作らない */
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
    groups[tier && s.logoId !== null ? tier : 'planD'].push(s);
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
