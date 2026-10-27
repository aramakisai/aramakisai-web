import { describe, expect, it } from 'vitest';

import { readDeviceStatus } from './parking-device-status';

const headers = (o: Record<string, string>) => new Headers(o);

describe('readDeviceStatus', () => {
  it('5 項目すべて正しければそのまま読む', () => {
    expect(
      readDeviceStatus(
        headers({
          'X-Device-Rssi': '-67',
          'X-Device-Uptime': '3600',
          'X-Device-Reset-Reason': 'TASK_WDT',
          'X-Device-Failures': '2',
          'X-Device-Firmware': 'v1.2.3',
        }),
      ),
    ).toEqual({ rssi: -67, uptime: 3600, resetReason: 'TASK_WDT', failures: 2, firmware: 'v1.2.3' });
  });

  it('欠落は値なしになる', () => {
    expect(readDeviceStatus(headers({}))).toEqual({
      rssi: null,
      uptime: null,
      resetReason: null,
      failures: null,
      firmware: null,
    });
  });

  it('範囲外・小数の RSSI はその項目だけ値なしになる', () => {
    const r = (v: string) => readDeviceStatus(headers({ 'X-Device-Rssi': v, 'X-Device-Failures': '1' }));
    expect(r('-67.5').rssi).toBeNull();
    expect(r('1').rssi).toBeNull();
    expect(r('-128').rssi).toBeNull();
    expect(r('0').rssi).toBe(0);
    expect(r('-127').rssi).toBe(-127);
    expect(r('-67.5').failures).toBe(1);
  });

  it('uptime と failures の上限を超えると値なし', () => {
    expect(readDeviceStatus(headers({ 'X-Device-Uptime': '4294967295' })).uptime).toBe(4294967295);
    expect(readDeviceStatus(headers({ 'X-Device-Uptime': '4294967296' })).uptime).toBeNull();
    expect(readDeviceStatus(headers({ 'X-Device-Failures': '1000001' })).failures).toBeNull();
    expect(readDeviceStatus(headers({ 'X-Device-Failures': '-1' })).failures).toBeNull();
  });

  it('33 字の再起動理由・小文字は値なし、32 字は通る', () => {
    expect(readDeviceStatus(headers({ 'X-Device-Reset-Reason': 'A'.repeat(33) })).resetReason).toBeNull();
    expect(readDeviceStatus(headers({ 'X-Device-Reset-Reason': 'A'.repeat(32) })).resetReason).toBe('A'.repeat(32));
    expect(readDeviceStatus(headers({ 'X-Device-Reset-Reason': 'sw' })).resetReason).toBeNull();
  });

  it('65 字・非 ASCII の版は値なし', () => {
    expect(readDeviceStatus(headers({ 'X-Device-Firmware': 'a'.repeat(65) })).firmware).toBeNull();
    expect(readDeviceStatus(headers({ 'X-Device-Firmware': 'a'.repeat(64) })).firmware).toBe('a'.repeat(64));
    expect(readDeviceStatus(headers({ 'X-Device-Firmware': 'v1\u00e9' })).firmware).toBeNull();
  });
});
