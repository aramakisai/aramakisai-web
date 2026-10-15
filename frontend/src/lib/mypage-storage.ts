import type { ExhibitionCategory } from './exhibitions';
import { isStampCategory, type StampCategory } from './stamp-signature';

const STORAGE_KEY = 'aramakisai_mypage';

export const MYPAGE_STORAGE_KEY = STORAGE_KEY;
export const MYPAGE_CHANGE_EVENT = 'aramakisai:mypage-change';

// exhibitions.ts は実行時に import しない (型のみ参照) ためリテラルで持つ
export const BOOKMARK_CATEGORIES: readonly ExhibitionCategory[] = [
  'stage',
  'exhibit',
  'vendor',
  'other',
];

export interface SavedExhibitionRef {
  readonly id: number;
  readonly category: StampCategory;
  readonly savedAt: string;
}

export interface SavedBookmarkRef {
  readonly id: number;
  readonly category: ExhibitionCategory;
  readonly savedAt: string;
}

export type MypageListName = 'stamps' | 'bookmarks';

export interface MypageData {
  readonly version: 1;
  readonly lists: {
    readonly stamps: readonly SavedExhibitionRef[];
    readonly bookmarks: readonly SavedBookmarkRef[];
  };
}

export type AddResult = 'added' | 'exists' | 'unavailable';
export type RemoveResult = 'removed' | 'absent' | 'unavailable';

function isRef(
  value: unknown,
  isCategory: (c: string) => boolean,
): value is { id: number; category: string; savedAt: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    Number.isInteger(v.id) &&
    v.id > 0 &&
    typeof v.category === 'string' &&
    isCategory(v.category) &&
    typeof v.savedAt === 'string'
  );
}

const isSavedStamp = (v: unknown): v is SavedExhibitionRef =>
  isRef(v, isStampCategory);
const isSavedBookmark = (v: unknown): v is SavedBookmarkRef =>
  isRef(v, (c) => (BOOKMARK_CATEGORIES as readonly string[]).includes(c));

export function parseMypageData(raw: string | null): MypageData {
  const empty: MypageData = {
    version: 1,
    lists: { stamps: [], bookmarks: [] },
  };
  if (raw === null) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const { version, lists } = parsed as { version?: unknown; lists?: unknown };
    if (version !== 1 || typeof lists !== 'object' || lists === null) {
      return empty;
    }
    const { stamps, bookmarks } = lists as {
      stamps?: unknown;
      bookmarks?: unknown;
    };
    return {
      version: 1,
      lists: {
        stamps: Array.isArray(stamps) ? stamps.filter(isSavedStamp) : [],
        bookmarks: Array.isArray(bookmarks)
          ? bookmarks.filter(isSavedBookmark)
          : [],
      },
    };
  } catch {
    return empty;
  }
}

/** 未保存は null、ストレージが使えない場合は 'unavailable' */
export function readMypageRaw(): string | null | 'unavailable' {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return 'unavailable';
  }
}

/** 保存不可 (ストレージが使えない) は null。未保存・壊れた値は空のリスト */
export function readMypageData(): MypageData | null {
  const raw = readMypageRaw();
  return raw === 'unavailable' ? null : parseMypageData(raw);
}

// stamps と bookmarks は同じキーに同居するため、必ず全リストを読んで対象だけ差し替える
function writeList(
  data: MypageData,
  name: MypageListName,
  list: readonly unknown[],
): boolean {
  const next: MypageData = {
    version: 1,
    lists: { ...data.lists, [name]: list },
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  // storage イベントは書き込んだタブ自身には届かない
  window.dispatchEvent(new Event(MYPAGE_CHANGE_EVENT));
  return true;
}

function add(name: MypageListName, id: number, category: string): AddResult {
  const data = readMypageData();
  if (!data) return 'unavailable';
  const current = data.lists[name] as readonly {
    id: number;
    category: string;
  }[];
  if (current.some((s) => s.id === id && s.category === category)) {
    return 'exists';
  }
  const item = { id, category, savedAt: new Date().toISOString() };
  return writeList(data, name, [...current, item]) ? 'added' : 'unavailable';
}

export function addStamp(id: number, category: StampCategory): AddResult {
  return add('stamps', id, category);
}

export function addBookmark(
  id: number,
  category: ExhibitionCategory,
): AddResult {
  return add('bookmarks', id, category);
}

export function removeBookmark(
  id: number,
  category: ExhibitionCategory,
): RemoveResult {
  const data = readMypageData();
  if (!data) return 'unavailable';
  const rest = data.lists.bookmarks.filter(
    (b) => !(b.id === id && b.category === category),
  );
  if (rest.length === data.lists.bookmarks.length) return 'absent';
  return writeList(data, 'bookmarks', rest) ? 'removed' : 'unavailable';
}
