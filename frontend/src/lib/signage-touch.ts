import type { SignageOrientation } from './signage';

export type TouchDestination =
  'map' | 'exhibitions' | 'timetable' | 'parking' | 'topics';

export const TOUCH_DESTINATIONS: readonly {
  readonly key: TouchDestination;
  readonly label: string;
  readonly path: string;
}[] = [
  { key: 'map', label: '構内マップ', path: '/signage/touch/map' },
  { key: 'exhibitions', label: '企画一覧', path: '/signage/touch/exhibitions' },
  {
    key: 'timetable',
    label: 'タイムテーブル',
    path: '/signage/touch/timetable',
  },
  { key: 'parking', label: '駐車場', path: '/signage/touch/parking' },
  { key: 'topics', label: 'トピック', path: '/signage/touch/topics' },
];

export const IDLE_TIMEOUT_MS = 60_000;
// globals.css の fade-in / fade-out と同じ値
export const CLOSE_FADE_MS = 600;
// 地図の描画完了の知らせが来ない場合に幕が残り続けないための上限。タイル取得は通常 1 秒前後で済み、
// それ以上待たせると読み込み中の表示のほうが長く目に付く
export const MAP_READY_TIMEOUT_MS = 3000;

export type TouchState =
  | { readonly kind: 'closed' }
  | {
      readonly kind: 'open';
      readonly destination: TouchDestination | null;
      readonly idleSince: number;
    }
  | {
      readonly kind: 'quakeHeld';
      readonly destination: TouchDestination | null;
    }
  | { readonly kind: 'closing' };

export type TouchEvent =
  | {
      readonly type: 'tap';
      readonly at: number;
      readonly orientation: SignageOrientation;
    }
  | {
      readonly type: 'select';
      // null はトップ(行き先未選択)へ戻す
      readonly destination: TouchDestination | null;
      readonly at: number;
    }
  | { readonly type: 'activity'; readonly at: number }
  | { readonly type: 'tick'; readonly at: number }
  | { readonly type: 'back' }
  | { readonly type: 'quake'; readonly active: boolean }
  | { readonly type: 'pin' }
  | { readonly type: 'fadeEnd' };

export function nextTouchState(
  state: TouchState,
  event: TouchEvent,
): TouchState {
  switch (state.kind) {
    case 'closed':
      return event.type === 'tap' && event.orientation === 'landscape'
        ? { kind: 'open', destination: null, idleSince: event.at }
        : state;
    case 'open':
      switch (event.type) {
        case 'select':
          return {
            kind: 'open',
            destination: event.destination,
            idleSince: event.at,
          };
        case 'activity':
          return { ...state, idleSince: event.at };
        case 'tick':
          return event.at - state.idleSince >= IDLE_TIMEOUT_MS
            ? { kind: 'closing' }
            : state;
        case 'back':
        case 'pin':
          return { kind: 'closing' };
        case 'quake':
          return event.active
            ? { kind: 'quakeHeld', destination: state.destination }
            : state;
        default:
          return state;
      }
    case 'quakeHeld':
      return event.type === 'quake' && !event.active
        ? { kind: 'closing' }
        : state;
    case 'closing':
      return event.type === 'fadeEnd' ? { kind: 'closed' } : state;
  }
}

const PUBLIC_TO_TOUCH = /^\/(exhibitions(\/[^/]+\/[^/]+)?|topics(\/[^/]+)?)$/;

/** 公開パスを端末用パスへ読み替える。端末用に無い行き先はnull(遮断) */
export function toTouchHref(href: string): string | null {
  if (href.startsWith('#') || href.startsWith('/signage/touch/')) return href;
  return PUBLIC_TO_TOUCH.test(href) ? `/signage/touch${href}` : null;
}
