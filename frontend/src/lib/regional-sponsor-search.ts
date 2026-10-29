import {
  getRegionalSponsorCategoryPresentation,
  type RegionalSponsorCategory,
} from './regional-sponsor-categories';
import type { RegionalSponsor } from './regional-sponsors';

export function normalizeRegionalSponsorSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja-JP');
}

export function filterRegionalSponsors(
  sponsors: readonly RegionalSponsor[],
  query: string,
  selectedCategories: ReadonlySet<RegionalSponsorCategory>,
): readonly RegionalSponsor[] {
  const normalizedQuery = normalizeRegionalSponsorSearch(query);
  return sponsors.filter((sponsor) => {
    if (
      selectedCategories.size > 0 &&
      !selectedCategories.has(sponsor.category as RegionalSponsorCategory)
    ) {
      return false;
    }
    if (normalizedQuery === '') return true;
    return [
      sponsor.name,
      getRegionalSponsorCategoryPresentation(sponsor.category).label,
      sponsor.address ?? '',
    ].some((value) =>
      normalizeRegionalSponsorSearch(value).includes(normalizedQuery),
    );
  });
}

export function toggleRegionalSponsorCategory(
  selectedCategories: ReadonlySet<RegionalSponsorCategory>,
  category: RegionalSponsorCategory | 'all',
): ReadonlySet<RegionalSponsorCategory> {
  if (category === 'all') return new Set();
  const next = new Set(selectedCategories);
  if (next.has(category)) next.delete(category);
  else next.add(category);
  return next;
}
