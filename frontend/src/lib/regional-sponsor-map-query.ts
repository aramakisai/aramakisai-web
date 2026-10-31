import {
  REGIONAL_SPONSOR_CATEGORIES,
  type RegionalSponsorCategory,
} from './regional-sponsor-categories';

const PATH = '/sponsors/local';

/** 地域協賛マップの絞り込み条件。店舗は単一選択 */
export interface RegionalSponsorMapFilters {
  readonly q: string;
  readonly categories: readonly RegionalSponsorCategory[];
  readonly selectedSponsorId: number | null;
}

export const EMPTY_REGIONAL_SPONSOR_MAP_FILTERS: RegionalSponsorMapFilters = {
  q: '',
  categories: [],
  selectedSponsorId: null,
};

export function parseRegionalSponsorMapQuery(
  params: URLSearchParams,
): RegionalSponsorMapFilters {
  const requested = new Set((params.get('category') ?? '').split(','));
  const sponsor = Number(params.get('sponsor'));
  return {
    q: (params.get('q') ?? '').trim(),
    categories: REGIONAL_SPONSOR_CATEGORIES.filter((c) => requested.has(c)),
    selectedSponsorId:
      Number.isInteger(sponsor) && sponsor > 0 ? sponsor : null,
  };
}

export function buildRegionalSponsorMapHref(
  filters: RegionalSponsorMapFilters,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  const categories = REGIONAL_SPONSOR_CATEGORIES.filter((c) =>
    filters.categories.includes(c),
  );
  if (categories.length > 0) params.set('category', categories.join(','));
  if (filters.selectedSponsorId !== null) {
    params.set('sponsor', String(filters.selectedSponsorId));
  }
  // カンマは query でそのまま使える文字なので、読みやすさを優先して戻す
  const qs = params.toString().replaceAll('%2C', ',');
  return qs ? `${PATH}?${qs}` : PATH;
}
