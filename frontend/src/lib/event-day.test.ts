import { describe, it, expect } from 'vitest';
import {
  formatEventDayLabel,
  formatEventDayTime,
  getDaysUntilEventDay,
  toEventDays,
} from './event-day';

describe('formatEventDayLabel', () => {
  it('開場日時 (UTC ISO) を日本時間の月日と曜日で表す', () => {
    // 2026-09-27T00:00:00Z は JST では 09-27 09:00 (日曜)
    expect(formatEventDayLabel('2026-09-27T00:00:00.000Z')).toBe('9月27日(日)');
  });

  it('UTC 深夜で日本時間側は日付が繰り上がる場合も JST の日付を使う', () => {
    // 2026-09-26T15:00:00Z は JST では 09-27 00:00 (日曜)
    expect(formatEventDayLabel('2026-09-26T15:00:00.000Z')).toBe('9月27日(日)');
  });
});

describe('formatEventDayTime', () => {
  it('ISO 日時から日本時間の時刻部分 (HH:mm) を取り出す', () => {
    expect(formatEventDayTime('2026-09-27T01:00:00.000Z')).toBe('10:00');
  });

  it('分をゼロ埋めする', () => {
    expect(formatEventDayTime('2026-09-27T00:05:00.000Z')).toBe('09:05');
  });
});

describe('getDaysUntilEventDay', () => {
  it('同じ日本時間の日付なら 0 を返す', () => {
    const now = new Date('2026-09-26T15:00:00.000Z'); // JST 09-27 00:00
    expect(
      getDaysUntilEventDay('2026-09-27T01:00:00.000Z', now), // JST 09-27 10:00
    ).toBe(0);
  });

  it('日本時間の 0 時をまたぐ前後で境目を越える', () => {
    // now が UTC 14:59 (JST 09-26 23:59) の間は残り 1 日
    const beforeMidnightJst = new Date('2026-09-26T14:59:00.000Z');
    expect(
      getDaysUntilEventDay('2026-09-27T01:00:00.000Z', beforeMidnightJst),
    ).toBe(1);

    // now が UTC 15:00 (JST 09-27 00:00) になった瞬間に残り 0 日へ切り替わる
    const atMidnightJst = new Date('2026-09-26T15:00:00.000Z');
    expect(
      getDaysUntilEventDay('2026-09-27T01:00:00.000Z', atMidnightJst),
    ).toBe(0);
  });

  it('開催日を過ぎていれば負の値を返す', () => {
    const now = new Date('2026-09-28T15:00:00.000Z'); // JST 09-29 00:00
    expect(getDaysUntilEventDay('2026-09-27T01:00:00.000Z', now)).toBe(-2);
  });
});

describe('toEventDays', () => {
  it('label が空文字なら null に変換する (管理画面でラベルを消すと空文字で保存されるため)', () => {
    const result = toEventDays([
      {
        start_at: '2026-09-27T00:00:00.000Z',
        end_at: '2026-09-27T09:00:00.000Z',
        label: '',
      },
    ]);
    expect(result[0].label).toBeNull();
  });

  it('label が未設定 (undefined) でも null に変換する', () => {
    const result = toEventDays([
      {
        start_at: '2026-09-27T00:00:00.000Z',
        end_at: '2026-09-27T09:00:00.000Z',
      },
    ]);
    expect(result[0].label).toBeNull();
  });

  it('label が設定されていればそのまま使う', () => {
    const result = toEventDays([
      {
        start_at: '2026-09-27T00:00:00.000Z',
        end_at: '2026-09-27T09:00:00.000Z',
        label: '1日目',
      },
    ]);
    expect(result[0].label).toBe('1日目');
  });

  it('null/undefined の event_days は空配列を返す', () => {
    expect(toEventDays(null)).toEqual([]);
    expect(toEventDays(undefined)).toEqual([]);
  });
});
