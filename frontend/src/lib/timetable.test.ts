import { describe, expect, it } from 'vitest';
import {
  combineJstDateTime,
  isPerformanceActive,
  resolveInitialDayKey,
  type TimetableDay,
} from './timetable';

describe('combineJstDateTime', () => {
  it('開催日のJST暦日とJST時刻から絶対時刻を作る', () => {
    // 開催日は JST 暦日の UTC 正午、時刻は JST 10:30 = 01:30Z
    expect(
      combineJstDateTime('2026-11-14', '1970-01-01T01:30:00.000Z'),
    ).toBe('2026-11-14T01:30:00.000Z');
  });

  it('JSTの0時直前(前日15:59Z)は同じ暦日の23:59になる', () => {
    expect(
      combineJstDateTime('2026-11-14', '2026-01-01T14:59:00.000Z'),
    ).toBe('2026-11-14T14:59:00.000Z');
  });

  it('JSTの0時ちょうど(前日15:00Z)は暦日の00:00になる', () => {
    expect(
      combineJstDateTime('2026-11-14', '2026-01-01T15:00:00.000Z'),
    ).toBe('2026-11-13T15:00:00.000Z');
  });

  it('時刻側の日付部分は無視する', () => {
    expect(
      combineJstDateTime('2026-11-15', '2020-05-05T05:00:00.000Z'),
    ).toBe('2026-11-15T05:00:00.000Z');
  });
});

describe('resolveInitialDayKey', () => {
  const days: TimetableDay[] = [
    { key: '2026-11-14', label: '1日目' },
    { key: '2026-11-15', label: '2日目' },
  ];

  it('現在のJST暦日が開催日にあればその日', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-15T03:00:00Z'))).toBe(
      '2026-11-15',
    );
  });

  it('UTCでは前日でもJSTで開催日ならその日(JST 0時直後)', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-14T15:00:00Z'))).toBe(
      '2026-11-15',
    );
  });

  it('JST 0時直前は前日のまま', () => {
    expect(resolveInitialDayKey(days, new Date('2026-11-14T14:59:59Z'))).toBe(
      '2026-11-14',
    );
  });

  it('期間外なら最初の開催日', () => {
    expect(resolveInitialDayKey(days, new Date('2026-10-01T00:00:00Z'))).toBe(
      '2026-11-14',
    );
    expect(resolveInitialDayKey(days, new Date('2027-01-01T00:00:00Z'))).toBe(
      '2026-11-14',
    );
  });

  it('開催日程が空ならnull', () => {
    expect(resolveInitialDayKey([], new Date())).toBeNull();
  });
});

describe('isPerformanceActive', () => {
  const slot = {
    dateKey: '2026-11-14',
    startAt: '2026-11-14T01:00:00.000Z',
    endAt: '2026-11-14T02:00:00.000Z',
  };

  it('開始ちょうどは真', () => {
    expect(isPerformanceActive(slot, new Date(slot.startAt))).toBe(true);
  });

  it('終了ちょうどは偽', () => {
    expect(isPerformanceActive(slot, new Date(slot.endAt))).toBe(false);
  });

  it('開始前と終了後は偽、区間内は真', () => {
    expect(isPerformanceActive(slot, new Date('2026-11-14T00:59:59Z'))).toBe(
      false,
    );
    expect(isPerformanceActive(slot, new Date('2026-11-14T01:30:00Z'))).toBe(
      true,
    );
  });

  it('別の日の同時刻は偽', () => {
    expect(isPerformanceActive(slot, new Date('2026-11-15T01:30:00Z'))).toBe(
      false,
    );
  });
});
