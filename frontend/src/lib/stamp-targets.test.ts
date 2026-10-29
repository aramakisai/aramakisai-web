import { describe, expect, it } from 'vitest';
import { toStampTargets } from './stamp-targets';
import type { ExhibitionCardSummary } from './exhibitions';

const card = (id: number, category: string, areaIds: number[]) =>
  ({
    id,
    category,
    displayName: `企画${id}`,
    areaIds,
  }) as unknown as ExhibitionCardSummary;

describe('toStampTargets', () => {
  it('スタンプ対象のカテゴリだけを残し、先頭のエリアを割り当てる', () => {
    const targets = toStampTargets([
      card(1, 'exhibit', [3, 4]),
      card(2, 'stage', [1]),
      card(3, 'exhibit', []),
    ]);
    expect(targets).toEqual([
      { id: 1, category: 'exhibit', displayName: '企画1', areaId: 3 },
      { id: 3, category: 'exhibit', displayName: '企画3', areaId: null },
    ]);
  });
});
