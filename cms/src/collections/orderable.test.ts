import { describe, expect, it } from 'vitest';

import { FaqItems } from './faq-items';
import { MapAreas } from './map-areas';
import { Pages } from './pages';
import { ParkingLots } from './parking-lots';
import { Sponsors } from './sponsors';
import { Stages } from './stages';
import { Topics } from './topics';

describe.each([FaqItems, MapAreas, ParkingLots, Sponsors, Stages])('$slug のドラッグ並べ替え', (c) => {
  it('orderable で、既定の並びと一覧の列に sort を使わない', () => {
    expect(c.orderable).toBe(true);
    expect(c.defaultSort).toBeUndefined();
    expect(c.admin?.defaultColumns ?? []).not.toContain('sort');
  });
});

describe.each([FaqItems, MapAreas, ParkingLots, Sponsors, Stages, Pages, Topics])('$slug の表示順', (c) => {
  it('sort フィールドを持たず、既定の並びと一覧の列にも使わない', () => {
    expect(c.fields.some((x) => 'name' in x && x.name === 'sort')).toBe(false);
    expect(c.defaultSort).toBeUndefined();
    expect(c.admin?.defaultColumns ?? []).not.toContain('sort');
  });
});
