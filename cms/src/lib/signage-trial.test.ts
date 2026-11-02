import { describe, expect, it } from 'vitest';

import { decideTrialAnchor, validateTrialStart } from './signage-trial';

const prev = { start_at: '2026-11-07T09:00:00+09:00', anchored_at: '2026-11-01T00:00:00.000Z' };
const NOW = '2026-11-02T03:04:05.678Z';

describe('decideTrialAnchor', () => {
  it('送信なし(undefined)なら前の値を保持する', () => {
    expect(decideTrialAnchor(prev, undefined, NOW)).toEqual(prev);
  });

  it('前の値も送信もなければ両方 null', () => {
    expect(decideTrialAnchor(null, undefined, NOW)).toEqual({ start_at: null, anchored_at: null });
  });

  it('同値の再送信でも起点を刻み直す', () => {
    expect(decideTrialAnchor(prev, prev.start_at, NOW)).toEqual({ start_at: prev.start_at, anchored_at: '2026-11-02T03:04:05.000Z' });
  });

  it('別の値でも起点を現在時刻にする', () => {
    expect(decideTrialAnchor(prev, '2026-11-08T10:00:00+09:00', NOW)).toEqual({
      start_at: '2026-11-08T10:00:00+09:00',
      anchored_at: '2026-11-02T03:04:05.000Z',
    });
  });

  it('null で両方消す', () => {
    expect(decideTrialAnchor(prev, null, NOW)).toEqual({ start_at: null, anchored_at: null });
  });

  it('秒未満を切り捨てる', () => {
    expect(decideTrialAnchor(null, 'x', '2026-11-02T03:04:05.999Z').anchored_at).toBe('2026-11-02T03:04:05.000Z');
  });
});

describe('validateTrialStart', () => {
  const days = ['2026-11-07T09:30:00+09:00', '2026-11-08T09:30:00+09:00'];

  it('開催日の JST 日付と一致すれば ok', () => {
    expect(validateTrialStart('2026-11-07T12:00:00+09:00', days)).toEqual({ ok: true });
  });

  it('日付の境目 00:00 と 23:59 も同じ日として一致する', () => {
    expect(validateTrialStart('2026-11-08T00:00:00+09:00', days)).toEqual({ ok: true });
    expect(validateTrialStart('2026-11-08T23:59:00+09:00', days)).toEqual({ ok: true });
  });

  it('UTC 表記でも JST 日付で判定する', () => {
    expect(validateTrialStart('2026-11-06T15:00:00Z', days)).toEqual({ ok: true });
    expect(validateTrialStart('2026-11-07T15:00:00Z', days)).toEqual({ ok: true });
    expect(validateTrialStart('2026-11-08T15:00:00Z', days)).toEqual({ ok: false, reason: 'not_event_day' });
  });

  it('開催日でなければ not_event_day', () => {
    expect(validateTrialStart('2026-11-06T23:59:00+09:00', days)).toEqual({ ok: false, reason: 'not_event_day' });
    expect(validateTrialStart('2026-11-09T00:00:00+09:00', days)).toEqual({ ok: false, reason: 'not_event_day' });
  });

  it('開催日が0件なら no_event_days', () => {
    expect(validateTrialStart('2026-11-07T12:00:00+09:00', [])).toEqual({ ok: false, reason: 'no_event_days' });
  });
});
