import { describe, expect, it } from 'vitest';

import { buildEventDayOptions, eventDayLabel, eventDayValue } from './event-day-options';

const days = [
  { start_at: '2026-10-29T00:00:00.000Z', label: '1日目' },
  { start_at: '2026-10-30T00:30:00.000Z', label: '' },
];

describe('eventDayValue', () => {
  it('JST暦日のUTC正午にする', () => {
    // 10/29 JST 08:00 (前日UTC) でも暦日は JST 基準
    expect(eventDayValue('2026-10-28T23:00:00.000Z')).toBe('2026-10-29T12:00:00.000Z');
  });
  it('解釈できなければ null', () => {
    expect(eventDayValue('x')).toBeNull();
  });
});

describe('buildEventDayOptions', () => {
  it('labelありは「1日目(10/29)」、空は「10/30」', () => {
    expect(buildEventDayOptions(days, null)).toEqual([
      { label: '1日目(10/29)', value: '2026-10-29T12:00:00.000Z' },
      { label: '10/30', value: '2026-10-30T12:00:00.000Z' },
    ]);
  });
  it('開催日順に並べる', () => {
    expect(buildEventDayOptions([...days].reverse(), null).map((o) => o.value)).toEqual([
      '2026-10-29T12:00:00.000Z',
      '2026-10-30T12:00:00.000Z',
    ]);
  });
  it('開催日程外の現在値は「(開催日程外)」で末尾に残す', () => {
    expect(buildEventDayOptions(days, '2026-10-31T12:00:00.000Z')[2]).toEqual({
      label: '10/31(開催日程外)',
      value: '2026-10-31T12:00:00.000Z',
    });
  });
  it('現在値が開催日程内なら追加しない', () => {
    expect(buildEventDayOptions(days, '2026-10-29T03:00:00.000Z')).toHaveLength(2);
  });
});

describe('eventDayLabel', () => {
  it('選択肢と同じ文言', () => {
    expect(eventDayLabel(days, '2026-10-29T12:00:00.000Z')).toBe('1日目(10/29)');
    expect(eventDayLabel(days, '2026-10-31T12:00:00.000Z')).toBe('10/31(開催日程外)');
  });
  it('値なしは空文字', () => {
    expect(eventDayLabel(days, null)).toBe('');
  });
});
