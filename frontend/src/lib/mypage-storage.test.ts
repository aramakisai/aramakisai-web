import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MYPAGE_CHANGE_EVENT,
  HISTORY_LIMIT,
  addBookmark,
  clearHistory,
  parseMypageData,
  readMypageData,
  readMypageRaw,
  readVisitorId,
  recordHistory,
  removeBookmark,
  saveVisitorId,
} from './mypage-storage';

const KEY = 'aramakisai_mypage';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('mypage-storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('未保存は空のリスト', () => {
    expect(readMypageData()).toEqual({
      version: 1,
      lists: { bookmarks: [], history: [] },
    });
  });

  it('壊れたJSONは空のリストとして読み、追加で上書きできる', () => {
    window.localStorage.setItem(KEY, '{broken');
    expect(readMypageData()).toEqual({
      version: 1,
      lists: { bookmarks: [], history: [] },
    });
    expect(addBookmark(1, 'other')).toBe('added');
  });

  it('版番号が違う・形が違う値は空として扱う', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, lists: {} }));
    expect(readMypageData()!.lists.bookmarks).toEqual([]);
    window.localStorage.setItem(KEY, '[]');
    expect(readMypageData()!.lists.bookmarks).toEqual([]);
  });

  it('読み込みが例外になる環境では null と unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readMypageData()).toBeNull();
    expect(addBookmark(1, 'exhibit')).toBe('unavailable');
    expect(readVisitorId()).toBe('unavailable');
  });

  describe('visitorId', () => {
    it('未保存は null、保存すると読める', () => {
      expect(readVisitorId()).toBeNull();
      expect(saveVisitorId(ID)).toBe('saved');
      expect(readVisitorId()).toBe(ID);
    });

    it('ブックマークの追加・削除の後も残る', () => {
      saveVisitorId(ID);
      addBookmark(1, 'exhibit');
      removeBookmark(1, 'exhibit');
      addBookmark(2, 'stage');
      expect(readVisitorId()).toBe(ID);
    });

    it('匿名IDの保存はブックマークを消さない', () => {
      addBookmark(1, 'exhibit');
      saveVisitorId(ID);
      expect(readMypageData()!.lists.bookmarks).toHaveLength(1);
    });

    it('UUID v4 でない値は捨てる', () => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, visitorId: 'nope', lists: {} }),
      );
      expect(readVisitorId()).toBeNull();
    });

    it('既存の stamps 配列は読み込み時に捨て、書き込みでも残さない', () => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          lists: {
            stamps: [{ id: 1, category: 'exhibit', savedAt: 'x' }],
            bookmarks: [],
          },
        }),
      );
      expect(readMypageData()!.lists).toEqual({ bookmarks: [], history: [] });
      saveVisitorId(ID);
      expect(
        JSON.parse(window.localStorage.getItem(KEY)!).lists.stamps,
      ).toBeUndefined();
    });

    it('書き込み例外で unavailable、イベントは発火しない', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      const fn = vi.fn();
      window.addEventListener(MYPAGE_CHANGE_EVENT, fn);
      expect(saveVisitorId(ID)).toBe('unavailable');
      expect(fn).not.toHaveBeenCalled();
      window.removeEventListener(MYPAGE_CHANGE_EVENT, fn);
    });
  });

  describe('bookmarks', () => {
    it('追加・重複・解除の結果値', () => {
      expect(addBookmark(1, 'exhibit')).toBe('added');
      expect(addBookmark(1, 'exhibit')).toBe('exists');
      expect(addBookmark(1, 'vendor')).toBe('added');
      expect(removeBookmark(1, 'exhibit')).toBe('removed');
      expect(removeBookmark(1, 'exhibit')).toBe('absent');
      expect(readMypageData()!.lists.bookmarks).toMatchObject([
        { id: 1, category: 'vendor' },
      ]);
    });

    it('bookmarks 欠落は空、壊れた要素は捨てる', () => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, lists: {} }),
      );
      expect(readMypageData()!.lists.bookmarks).toEqual([]);
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          lists: {
            bookmarks: [
              { id: 1, category: 'other', savedAt: 'x' },
              { id: 2, category: 'zzz', savedAt: 'x' },
              { id: 0, category: 'other', savedAt: 'x' },
              null,
            ],
          },
        }),
      );
      expect(readMypageData()!.lists.bookmarks.map((b) => b.id)).toEqual([1]);
    });

    it('書き込み例外で unavailable', () => {
      addBookmark(1, 'exhibit');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      expect(addBookmark(2, 'exhibit')).toBe('unavailable');
      expect(removeBookmark(1, 'exhibit')).toBe('unavailable');
    });

    it('書き込み成功時に変更イベントを発火し、失敗時は発火しない', () => {
      const fn = vi.fn();
      window.addEventListener(MYPAGE_CHANGE_EVENT, fn);
      addBookmark(1, 'exhibit');
      removeBookmark(1, 'exhibit');
      expect(fn).toHaveBeenCalledTimes(2);
      addBookmark(1, 'exhibit');
      addBookmark(1, 'exhibit');
      expect(fn).toHaveBeenCalledTimes(3);
      window.removeEventListener(MYPAGE_CHANGE_EVENT, fn);
    });
  });

  it('readMypageRaw と parseMypageData', () => {
    expect(readMypageRaw()).toBeNull();
    addBookmark(1, 'exhibit');
    const raw = readMypageRaw() as string;
    expect(parseMypageData(raw).lists.bookmarks).toHaveLength(1);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readMypageRaw()).toBe('unavailable');
  });

  describe('閲覧履歴', () => {
    const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s));
    const ids = () => readMypageData()!.lists.history.map((h) => h.id);

    it('先頭に追加する', () => {
      expect(recordHistory(1, 'exhibit', at(1))).toBe('recorded');
      recordHistory(2, 'vendor', at(2));
      expect(readMypageData()!.lists.history).toEqual([
        { id: 2, category: 'vendor', viewedAt: at(2).toISOString() },
        { id: 1, category: 'exhibit', viewedAt: at(1).toISOString() },
      ]);
    });

    it('同じ組は先頭へ移し、別カテゴリは別扱い', () => {
      recordHistory(1, 'exhibit', at(1));
      recordHistory(2, 'exhibit', at(2));
      recordHistory(1, 'vendor', at(3));
      recordHistory(1, 'exhibit', at(4));
      expect(ids()).toEqual([1, 1, 2]);
      expect(readMypageData()!.lists.history[0].viewedAt).toBe(
        at(4).toISOString(),
      );
    });

    it('21件目で最古を捨てる', () => {
      for (let i = 1; i <= HISTORY_LIMIT + 1; i++)
        recordHistory(i, 'other', at(i));
      expect(ids()).toHaveLength(HISTORY_LIMIT);
      expect(ids()[0]).toBe(21);
      expect(ids()).not.toContain(1);
    });

    it('ブックマーク・端末識別子を変えず、ブックマーク操作も履歴を消さない', () => {
      saveVisitorId(ID);
      addBookmark(9, 'stage');
      recordHistory(1, 'exhibit', at(1));
      expect(readVisitorId()).toBe(ID);
      expect(readMypageData()!.lists.bookmarks.map((b) => b.id)).toEqual([9]);
      addBookmark(8, 'stage');
      removeBookmark(9, 'stage');
      expect(ids()).toEqual([1]);
    });

    it('書き込み不可は unavailable', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      expect(recordHistory(1, 'exhibit')).toBe('unavailable');
      expect(clearHistory()).toEqual({ kind: 'unavailable' });
    });

    it('消去は件数を返し、ブックマークを残す', () => {
      addBookmark(9, 'stage');
      recordHistory(1, 'exhibit');
      recordHistory(2, 'exhibit');
      expect(clearHistory()).toEqual({ kind: 'cleared', count: 2 });
      expect(ids()).toEqual([]);
      expect(readMypageData()!.lists.bookmarks).toHaveLength(1);
      expect(clearHistory()).toEqual({ kind: 'cleared', count: 0 });
    });

    it('history 欠落は空、不正要素だけ除く', () => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, lists: { bookmarks: [] } }),
      );
      expect(readMypageData()!.lists.history).toEqual([]);
      const ok = { id: 1, category: 'exhibit', viewedAt: 'x' };
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          lists: {
            bookmarks: [],
            history: [
              ok,
              { id: 0, category: 'exhibit', viewedAt: 'x' },
              { id: 2, category: 'zzz', viewedAt: 'x' },
              { id: 3, category: 'other' },
              null,
            ],
          },
        }),
      );
      expect(readMypageData()!.lists.history).toEqual([ok]);
    });
  });
});
