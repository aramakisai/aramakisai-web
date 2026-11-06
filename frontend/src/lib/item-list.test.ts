import { describe, expect, it, vi } from 'vitest';
import { listingHref } from './exhibitions';
import { toItemListEntries } from './item-list';

vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

const cards = [
  { id: 3, category: 'exhibit', displayName: '写真展' },
  { id: 7, category: 'booth', displayName: '協賛ブース' },
] as const;

describe('toItemListEntries', () => {
  it('先頭番号25から掲載位置が始まる', () => {
    const entries = toItemListEntries(cards, 25);
    expect(entries.map((e) => e.item.index)).toEqual([25, 26]);
  });

  it('href が listingHref と一致する', () => {
    const entries = toItemListEntries(cards, 1);
    expect(entries.map((e) => e.href)).toEqual(cards.map(listingHref));
  });

  it('アイテムid・表示名・カテゴリを作り、企業ブースは booth で作る', () => {
    const entries = toItemListEntries(cards, 1);
    expect(entries[0]!.item).toEqual({
      item_id: '3:exhibit',
      item_name: '写真展',
      item_category: 'exhibit',
      index: 1,
    });
    expect(entries[1]!.item.item_id).toBe('7:booth');
  });
});
