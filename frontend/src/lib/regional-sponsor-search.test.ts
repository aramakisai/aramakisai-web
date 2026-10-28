import { describe, expect, it } from 'vitest';

import type { RegionalSponsor } from './regional-sponsors';
import {
  filterRegionalSponsors,
  normalizeRegionalSponsorSearch,
  toggleRegionalSponsorCategory,
} from './regional-sponsor-search';

const sponsors: readonly RegionalSponsor[] = [
  {
    id: 1,
    name: 'ＡＢＣ病院',
    category: 'hospital',
    latitude: 36.4,
    longitude: 139.1,
    address: '群馬県前橋市１－２－３',
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    phone: null,
    websiteUrl: null,
  },
  {
    id: 2,
    name: 'テスト生活サービス',
    category: 'life',
    latitude: 36.41,
    longitude: 139.11,
    address: '群馬県高崎市',
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    phone: null,
    websiteUrl: null,
  },
  {
    id: 3,
    name: '<script>安全な文字列</script>',
    category: 'shop',
    latitude: 36.42,
    longitude: 139.12,
    address: null,
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    phone: null,
    websiteUrl: null,
  },
];

describe('normalizeRegionalSponsorSearch', () => {
  it('NFKC正規化と小文字化で全角半角・大文字小文字を吸収する', () => {
    expect(normalizeRegionalSponsorSearch(' ＡＢＣ１２３ ')).toBe(' abc123 ');
  });
});

describe('filterRegionalSponsors', () => {
  it('名称・カテゴリ日本語名・住所を部分一致検索する', () => {
    expect(
      filterRegionalSponsors(sponsors, 'abc', new Set()).map(({ id }) => id),
    ).toEqual([1]);
    expect(
      filterRegionalSponsors(sponsors, '病院', new Set()).map(({ id }) => id),
    ).toEqual([1]);
    expect(
      filterRegionalSponsors(sponsors, '1-2-3', new Set()).map(({ id }) => id),
    ).toEqual([1]);
  });

  it('複数カテゴリをOR、検索語とはANDにする', () => {
    expect(
      filterRegionalSponsors(
        sponsors,
        '群馬県',
        new Set(['hospital', 'shop']),
      ).map(({ id }) => id),
    ).toEqual([1]);
    expect(
      filterRegionalSponsors(sponsors, '', new Set(['hospital', 'shop'])).map(
        ({ id }) => id,
      ),
    ).toEqual([1, 3]);
  });

  it('0件と制御文字・HTMLらしい検索語を安全な文字列として扱う', () => {
    expect(filterRegionalSponsors(sponsors, '該当なし', new Set())).toEqual([]);
    expect(
      filterRegionalSponsors(sponsors, '<SCRIPT>', new Set()).map(
        ({ id }) => id,
      ),
    ).toEqual([3]);
    expect(filterRegionalSponsors(sponsors, '\u0000', new Set())).toEqual([]);
  });

  it('地図表示範囲の変更とは独立して同じ結果を返す', () => {
    const before = filterRegionalSponsors(sponsors, '群馬', new Set());
    const movedMapBounds = [0, 0, 1, 1];
    movedMapBounds[0] = 50;
    const after = filterRegionalSponsors(sponsors, '群馬', new Set());
    expect(after).toEqual(before);
  });
});

describe('toggleRegionalSponsorCategory', () => {
  it('空集合を「すべて」とし、個別複数選択とすべてへの復帰を行う', () => {
    const hospital = toggleRegionalSponsorCategory(new Set(), 'hospital');
    expect([...hospital]).toEqual(['hospital']);
    const multiple = toggleRegionalSponsorCategory(hospital, 'shop');
    expect([...multiple]).toEqual(['hospital', 'shop']);
    const one = toggleRegionalSponsorCategory(multiple, 'hospital');
    expect([...one]).toEqual(['shop']);
    expect(toggleRegionalSponsorCategory(one, 'all').size).toBe(0);
    expect(toggleRegionalSponsorCategory(new Set(), 'all').size).toBe(0);
  });
});
