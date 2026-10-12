import { isStampCategory, type StampCategory } from './stamp-signature';

const STORAGE_KEY = 'aramakisai_mypage';

export interface SavedExhibitionRef {
  readonly id: number;
  readonly category: StampCategory;
  readonly savedAt: string;
}

export type MypageListName = 'stamps';

export interface MypageData {
  readonly version: 1;
  readonly lists: Readonly<
    Record<MypageListName, readonly SavedExhibitionRef[]>
  >;
}

export type AddResult = 'added' | 'exists' | 'unavailable';

function isSavedRef(value: unknown): value is SavedExhibitionRef {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'number' &&
    Number.isInteger(v.id) &&
    v.id > 0 &&
    typeof v.category === 'string' &&
    isStampCategory(v.category) &&
    typeof v.savedAt === 'string'
  );
}

function parse(raw: string | null): MypageData {
  const empty: MypageData = { version: 1, lists: { stamps: [] } };
  if (raw === null) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const { version, lists } = parsed as { version?: unknown; lists?: unknown };
    if (version !== 1 || typeof lists !== 'object' || lists === null) {
      return empty;
    }
    const stamps = (lists as { stamps?: unknown }).stamps;
    return {
      version: 1,
      lists: { stamps: Array.isArray(stamps) ? stamps.filter(isSavedRef) : [] },
    };
  } catch {
    return empty;
  }
}

/** 保存不可 (ストレージが使えない) は null。未保存・壊れた値は空のリスト */
export function readMypageData(): MypageData | null {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function addStamp(id: number, category: StampCategory): AddResult {
  const data = readMypageData();
  if (!data) return 'unavailable';
  if (data.lists.stamps.some((s) => s.id === id && s.category === category)) {
    return 'exists';
  }
  const next: MypageData = {
    version: 1,
    lists: {
      ...data.lists,
      stamps: [
        ...data.lists.stamps,
        { id, category, savedAt: new Date().toISOString() },
      ],
    },
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return 'added';
  } catch {
    return 'unavailable';
  }
}
