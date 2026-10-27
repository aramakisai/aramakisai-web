import { describe, expect, it } from 'vitest';

import { isWithinMonitorWindow, validateMonitorEnd, validateMonitorStart } from './parking-monitor';
import { SiteSettings } from '../globals/site-settings';

const DEFAULT = { start: '09:00', end: '17:30' };
// 日本時間 h:m をそのまま UTC に直す (JST = UTC+9)
const jst = (h: number, m: number) => new Date(Date.UTC(2026, 8, 27, h - 9, m));

describe('isWithinMonitorWindow', () => {
  it('両端を含み、日本時間で判定する', () => {
    expect(isWithinMonitorWindow(jst(8, 55), DEFAULT)).toBe(false);
    expect(isWithinMonitorWindow(jst(9, 0), DEFAULT)).toBe(true);
    expect(isWithinMonitorWindow(jst(17, 30), DEFAULT)).toBe(true);
    expect(isWithinMonitorWindow(jst(17, 35), DEFAULT)).toBe(false);
  });

  it('日本時間の日付が UTC と異なる時刻でも正しく判定する', () => {
    expect(isWithinMonitorWindow(jst(0, 30), { start: '00:00', end: '01:00' })).toBe(true);
  });

  it('設定値に従う', () => {
    expect(isWithinMonitorWindow(jst(8, 55), { start: '08:30', end: '18:00' })).toBe(true);
    expect(isWithinMonitorWindow(jst(17, 35), { start: '08:30', end: '18:00' })).toBe(true);
  });
});

describe('検証', () => {
  it('HH:mm の形だけ通す', () => {
    expect(validateMonitorStart('09:00', { siblingData: { end: '17:30' } })).toBe(true);
    for (const bad of ['9:00', '24:00', '09:60', '0900', '']) {
      expect(validateMonitorStart(bad, { siblingData: { end: '17:30' } })).not.toBe(true);
      expect(validateMonitorEnd(bad, { siblingData: { start: '09:00' } })).not.toBe(true);
    }
  });

  it('start < end を要求する', () => {
    expect(validateMonitorEnd('09:00', { siblingData: { start: '09:00' } })).not.toBe(true);
    expect(validateMonitorEnd('08:00', { siblingData: { start: '09:00' } })).not.toBe(true);
    expect(validateMonitorEnd('09:01', { siblingData: { start: '09:00' } })).toBe(true);
  });
});

describe('site_settings.parking_monitor', () => {
  it('既定値が 09:00・17:30', () => {
    const json = JSON.stringify(SiteSettings.fields, (_, v) => (typeof v === 'function' ? undefined : v));
    expect(json).toContain('"name":"parking_monitor"');
    expect(json).toContain('"defaultValue":"09:00"');
    expect(json).toContain('"defaultValue":"17:30"');
  });
});
