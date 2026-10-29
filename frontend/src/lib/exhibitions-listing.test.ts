import { describe, expect, it, vi } from 'vitest';
import {
  buildExhibitionsHref,
  filterExhibitions,
  formatPlacementLocation,
  LISTING_CATEGORY_LABELS,
  LISTING_CATEGORY_VALUES,
  listingHref,
  parseExhibitionQuery,
  type CorporateBoothCard,
  type ExhibitionCardSummary,
  type ExhibitionQuery,
  type ListingCard,
} from './exhibitions';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

const base: ExhibitionQuery = { q: '', categories: [], areaIds: [], page: 1 };

const student: ExhibitionCardSummary = {
  id: 1,
  category: 'exhibit',
  displayName: '写真展',
  organizationName: '写真部',
  location: null,
  areaIds: [10],
  thumbnail: null,
};
const booth: CorporateBoothCard = {
  id: 2,
  category: 'booth',
  displayName: 'たこ焼き',
  organizationName: '株式会社ウニ',
  location: null,
  areaIds: [20],
  thumbnail: null,
};
const items: readonly ListingCard[] = [student, booth];

describe('LISTING_CATEGORY', () => {
  it('既存 4 カテゴリの後ろに企業ブースが並ぶ', () => {
    expect(LISTING_CATEGORY_VALUES).toEqual([
      'stage',
      'exhibit',
      'vendor',
      'other',
      'booth',
    ]);
    expect(LISTING_CATEGORY_LABELS.booth).toBe('企業ブース');
  });
});

describe('parseExhibitionQuery / buildExhibitionsHref', () => {
  it('category=booth を受け付け定義順にそろえる', () => {
    expect(
      parseExhibitionQuery({ category: 'booth,stage' }).categories,
    ).toEqual(['stage', 'booth']);
  });

  it('既存値の URL 正規化は変わらない', () => {
    expect(
      buildExhibitionsHref({ ...base, categories: ['other', 'stage'] }),
    ).toBe('/exhibitions?category=stage,other');
    expect(
      buildExhibitionsHref({ ...base, categories: ['booth', 'stage'] }),
    ).toBe('/exhibitions?category=stage,booth');
  });
});

describe('listingHref', () => {
  it('学生企画と企業ブースで URL 規則が異なる', () => {
    expect(listingHref(student)).toBe('/exhibitions/1/exhibit');
    expect(listingHref(booth)).toBe('/exhibitions/booth/2');
  });
});

describe('filterExhibitions (企業ブース混在)', () => {
  it('企業名・企画名のキーワードで絞り、入力順を保つ', () => {
    expect(filterExhibitions(items, { ...base, q: 'ウニ' })).toEqual([booth]);
    expect(filterExhibitions(items, { ...base, q: 'たこ' })).toEqual([booth]);
    expect(filterExhibitions(items, base)).toEqual([student, booth]);
  });

  it('カテゴリ・エリアで絞る', () => {
    expect(
      filterExhibitions(items, { ...base, categories: ['booth'] }),
    ).toEqual([booth]);
    expect(filterExhibitions(items, { ...base, areaIds: [20] })).toEqual([
      booth,
    ]);
  });
});

describe('formatPlacementLocation', () => {
  it('エリア名・番号を空白区切りで連結する', () => {
    expect(formatPlacementLocation('中庭', 'A-1')).toBe('中庭 A-1');
    expect(formatPlacementLocation('中庭', undefined)).toBe('中庭');
  });

  it('エリア未解決なら null', () => {
    expect(formatPlacementLocation(undefined, 'A-1')).toBeNull();
  });
});
