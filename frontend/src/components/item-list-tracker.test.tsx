import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toItemListEntries } from '@/lib/item-list';
import { ItemListTracker } from './item-list-tracker';

const sendGaEvent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

const cards = [
  { id: 1, category: 'exhibit', displayName: 'A' },
  { id: 2, category: 'exhibit', displayName: 'B' },
] as const;

const entries = toItemListEntries(cards, 24);

function renderTracker(e: typeof entries, filtered?: boolean) {
  return (
    <ItemListTracker listId="exhibitions" entries={e} filtered={filtered}>
      <a href={entries[0].href}>card-a</a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/other">other</a>
      <button type="button">bookmark</button>
    </ItemListTracker>
  );
}

describe('ItemListTracker', () => {
  beforeEach(() => {
    sendGaEvent.mockClear();
    // jsdom はリンク遷移で "not implemented: navigation" を出すため抑止する
    document.addEventListener('click', (e) => e.preventDefault(), {
      once: true,
    });
  });

  it('同じ項目で再描画しても view_item_list は1回だけ送る', () => {
    const { rerender } = render(renderTracker(entries, false));
    rerender(renderTracker([...entries], false));
    const calls = sendGaEvent.mock.calls.filter(
      ([n]) => n === 'view_item_list',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({
      item_list_id: 'exhibitions',
      item_list_name: 'exhibitions',
      list_filtered: 'false',
      items: entries.map((x) => x.item),
    });
  });

  it('並びが変わると再送し、空なら送らない', () => {
    const { rerender } = render(renderTracker(entries));
    rerender(renderTracker([entries[1], entries[0]]));
    expect(sendGaEvent).toHaveBeenCalledTimes(2);
    rerender(renderTracker([]));
    expect(sendGaEvent).toHaveBeenCalledTimes(2);
  });

  it('カードのリンクで select_item を送る', () => {
    render(renderTracker(entries, true));
    sendGaEvent.mockClear();
    fireEvent.click(screen.getByText('card-a'));
    expect(sendGaEvent).toHaveBeenCalledWith('select_item', {
      item_list_id: 'exhibitions',
      item_list_name: 'exhibitions',
      list_filtered: 'true',
      items: [entries[0].item],
    });
  });

  it('一致しないリンクとボタンでは送らない', () => {
    render(renderTracker(entries));
    sendGaEvent.mockClear();
    fireEvent.click(screen.getByText('other'));
    fireEvent.click(screen.getByText('bookmark'));
    expect(sendGaEvent).not.toHaveBeenCalled();
  });

  it('list_filtered は filtered 未指定なら付けない', () => {
    render(renderTracker(entries));
    expect(sendGaEvent.mock.calls[0][1]).not.toHaveProperty('list_filtered');
  });
});
