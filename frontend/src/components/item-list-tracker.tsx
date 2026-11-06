'use client';

import { useEffect, useRef } from 'react';
import { sendGaEvent } from '@/lib/analytics';
import type { ItemListEntry, ItemListId } from '@/lib/item-list';

interface ItemListTrackerProps {
  readonly listId: ItemListId;
  readonly entries: readonly ItemListEntry[];
  /** 企画一覧のときだけ渡す */
  readonly filtered?: boolean;
  readonly children: React.ReactNode;
}

export function ItemListTracker({
  listId,
  entries,
  filtered,
  children,
}: ItemListTrackerProps) {
  const lastKey = useRef<string | null>(null);
  const key = entries.map((e) => e.item.item_id).join(',');
  const listParams = {
    item_list_id: listId,
    item_list_name: listId,
    ...(filtered === undefined
      ? {}
      : { list_filtered: filtered ? ('true' as const) : ('false' as const) }),
  };

  useEffect(() => {
    if (entries.length === 0 || lastKey.current === key) return;
    lastKey.current = key;
    sendGaEvent('view_item_list', {
      ...listParams,
      items: entries.map((e) => e.item),
    });
    // key が entries の中身を代表する。参照が変わるだけの再描画では送らない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      style={{ display: 'contents' }}
      onClick={(event) => {
        const href = (event.target as Element)
          .closest('a')
          ?.getAttribute('href');
        const entry = entries.find((e) => e.href === href);
        if (entry) {
          sendGaEvent('select_item', { ...listParams, items: [entry.item] });
        }
      }}
    >
      {children}
    </div>
  );
}
