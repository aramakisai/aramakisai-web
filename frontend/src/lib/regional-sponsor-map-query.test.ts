import { describe, expect, it } from 'vitest';
import {
  buildRegionalSponsorMapHref,
  parseRegionalSponsorMapQuery,
} from './regional-sponsor-map-query';

describe('regional-sponsor-map-query', () => {
  it('条件を URL に載せて復元できる', () => {
    const filters = {
      q: '前橋',
      categories: ['food', 'hospital'] as const,
      selectedSponsorId: 12,
    };
    const href = buildRegionalSponsorMapHref(filters);
    expect(href).toBe(
      '/sponsors/local?q=%E5%89%8D%E6%A9%8B&category=hospital,food&sponsor=12',
    );
    expect(
      parseRegionalSponsorMapQuery(new URL(href, 'http://x').searchParams),
    ).toEqual({ ...filters, categories: ['hospital', 'food'] });
  });

  it('条件が空なら素のパスを返し、不正な値は捨てる', () => {
    expect(
      buildRegionalSponsorMapHref({
        q: '',
        categories: [],
        selectedSponsorId: null,
      }),
    ).toBe('/sponsors/local');
    expect(
      parseRegionalSponsorMapQuery(
        new URLSearchParams('category=x,food&sponsor=-1'),
      ),
    ).toEqual({ q: '', categories: ['food'], selectedSponsorId: null });
  });
});
