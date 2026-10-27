import { describe, expect, it } from 'vitest';

import { createParkingJudgeRate } from './parking-judge-rate';

const T0 = new Date('2026-09-27T03:00:00.000Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);

describe('ParkingJudgeRate', () => {
  it('1 分の上限で止まり、60 秒後に戻る', () => {
    const rate = createParkingJudgeRate();
    for (let i = 0; i < 15; i++) expect(rate.tryAcquire('gemini-3.1-flash-lite', plus(i))).toBe(true);
    expect(rate.tryAcquire('gemini-3.1-flash-lite', plus(1000))).toBe(false);
    expect(rate.tryAcquire('gemini-3.1-flash-lite', plus(60_000))).toBe(true);
  });

  it('モデルごとに別々に数える', () => {
    const rate = createParkingJudgeRate();
    for (let i = 0; i < 15; i++) rate.tryAcquire('gemini-3.1-flash-lite', T0);
    expect(rate.tryAcquire('gemma-4-26b-a4b-it', T0)).toBe(true);
  });

  it('gemma は 30RPM', () => {
    const rate = createParkingJudgeRate();
    for (let i = 0; i < 30; i++) expect(rate.tryAcquire('gemma-4-31b-it', T0)).toBe(true);
    expect(rate.tryAcquire('gemma-4-31b-it', T0)).toBe(false);
  });

  it('1 日の上限は太平洋時間の日付で戻る', () => {
    const rate = createParkingJudgeRate();
    // 太平洋夏時間 (UTC-7) の 2026-09-27 の昼。1 分あたりの上限に掛からないよう分散させる
    for (let i = 0; i < 500; i++) {
      expect(rate.tryAcquire('gemini-3.1-flash-lite', new Date(Date.UTC(2026, 8, 27, 12) + i * 61_000))).toBe(true);
    }
    expect(rate.tryAcquire('gemini-3.1-flash-lite', new Date('2026-09-28T06:00:00Z'))).toBe(false);
    // 2026-09-28 00:00 PDT = 07:00Z
    expect(rate.tryAcquire('gemini-3.1-flash-lite', new Date('2026-09-28T07:00:00Z'))).toBe(true);
  });

  it('休止中は取れず、時刻を過ぎると戻る', () => {
    const rate = createParkingJudgeRate();
    rate.coolDown('gemma-4-26b-a4b-it', plus(60_000));
    expect(rate.tryAcquire('gemma-4-26b-a4b-it', plus(59_999))).toBe(false);
    expect(rate.tryAcquire('gemma-4-26b-a4b-it', plus(60_000))).toBe(true);
  });

  it('取れなかった呼び出しは数えない', () => {
    const rate = createParkingJudgeRate();
    rate.coolDown('gemma-4-26b-a4b-it', plus(60_000));
    for (let i = 0; i < 100; i++) rate.tryAcquire('gemma-4-26b-a4b-it', plus(1000));
    for (let i = 0; i < 30; i++) expect(rate.tryAcquire('gemma-4-26b-a4b-it', plus(60_000))).toBe(true);
  });
});
