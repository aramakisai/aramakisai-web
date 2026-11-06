import {
  listingHref,
  type ExhibitionCardView,
  type ListingCategory,
} from './exhibitions';

export type ItemListId =
  'exhibitions' | 'home_featured' | 'mypage_bookmarks' | 'mypage_history';

export interface GaItem {
  readonly item_id: string;
  readonly item_name: string;
  readonly item_category: ListingCategory;
  readonly index: number;
}

export interface ItemListEntry {
  readonly href: string;
  readonly item: GaItem;
}

export function toItemListEntries(
  cards: readonly Pick<ExhibitionCardView, 'id' | 'category' | 'displayName'>[],
  firstIndex: number,
): readonly ItemListEntry[] {
  return cards.map((card, i) => ({
    href: listingHref(card),
    item: {
      item_id: `${card.id}:${card.category}`,
      item_name: card.displayName,
      item_category: card.category,
      index: firstIndex + i,
    },
  }));
}
