import { describe, expect, it } from 'vitest';
import { isTouchClockMessage, trialShiftMs } from './signage-trial';

describe('trialShiftMs', () => {
  const DAYS = ['2026-11-14T10:00:00+09:00', '2026-11-15T10:00:00+09:00'];
  const REAL = '2026-11-02T03:00:00Z';
  const trial = {
    start_at: '2026-11-14T10:00:00+09:00',
    anchored_at: '2026-11-02T12:00:00+09:00',
  };

  it('試験中は開始日時から起点を引いたミリ秒を返す', () => {
    expect(trialShiftMs(trial, DAYS, REAL)).toBe(
      Date.parse(trial.start_at) - Date.parse(trial.anchored_at),
    );
  });

  it.each([
    ['未設定', undefined],
    ['null', null],
    ['空', {}],
    ['起点なし', { start_at: trial.start_at, anchored_at: null }],
    ['開始日時なし', { start_at: null, anchored_at: trial.anchored_at }],
  ])('%s は null', (_, t) => {
    expect(trialShiftMs(t, DAYS, REAL)).toBeNull();
  });

  it('実時刻の JST 日付が開催日なら null', () => {
    // 2026-11-14T16:00Z は JST で 11-15 01:00 = 2日目
    expect(trialShiftMs(trial, DAYS, '2026-11-14T16:00:00Z')).toBeNull();
  });
});

describe('isTouchClockMessage', () => {
  it.each([
    [{ type: 'signage-touch-clock', trialShiftMs: 3600000 }],
    [{ type: 'signage-touch-clock', trialShiftMs: null }],
  ])('正しい型は true', (m) => {
    expect(isTouchClockMessage(m)).toBe(true);
  });

  it.each([
    [{ type: 'signage-touch-path', trialShiftMs: 1 }],
    [{ type: 'signage-touch-clock', trialShiftMs: '3' }],
    [{ type: 'signage-touch-clock' }],
    [null],
    ['signage-touch-clock'],
  ])('別 type や不正値は false', (m) => {
    expect(isTouchClockMessage(m)).toBe(false);
  });
});
