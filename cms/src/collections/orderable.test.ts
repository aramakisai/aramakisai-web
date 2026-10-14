import { describe, expect, it } from 'vitest';

import { FaqItems } from './faq-items';
import { MapAreas } from './map-areas';
import { ParkingLots } from './parking-lots';
import { Sponsors } from './sponsors';
import { Stages } from './stages';

describe.each([FaqItems, MapAreas, ParkingLots, Sponsors, Stages])('$slug のドラッグ並べ替え', (c) => {
  it('orderable で、既定の並びと一覧の列に sort を使わない', () => {
    expect(c.orderable).toBe(true);
    expect(c.defaultSort).toBeUndefined();
    expect(c.admin?.defaultColumns ?? []).not.toContain('sort');
  });
  it('旧 sort は管理画面で非表示のまま残る', () => {
    const f = c.fields.find((x) => 'name' in x && x.name === 'sort') as { admin?: { hidden?: boolean } };
    expect(f.admin?.hidden).toBe(true);
  });
});
