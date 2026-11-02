import type { CampusMapFilters } from './campus-map';
import type { ExhibitionQuery } from './exhibitions';

export type TouchFilters = ExhibitionQuery | CampusMapFilters;

export type TouchLocationMessage =
  | { readonly type: 'signage-touch-path'; readonly path: string }
  /** 地図タイルの描画が済み、幕を外してよいことを知らせる */
  | { readonly type: 'signage-touch-ready'; readonly path: string }
  | {
      readonly type: 'signage-touch-filters';
      readonly path: string;
      readonly filters: TouchFilters;
    };

export function postTouchMessage(message: TouchLocationMessage) {
  if (window.parent === window) return;
  window.parent.postMessage(message, window.location.origin);
}

export function isTouchMessage(data: unknown): data is TouchLocationMessage {
  if (typeof data !== 'object' || data === null) return false;
  const m = data as Record<string, unknown>;
  return (
    typeof m.path === 'string' &&
    (m.type === 'signage-touch-path' ||
      m.type === 'signage-touch-ready' ||
      (m.type === 'signage-touch-filters' &&
        typeof m.filters === 'object' &&
        m.filters !== null))
  );
}
