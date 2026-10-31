import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeTripUpdates, decodeVehicles } from './gtfs-realtime';

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)),
  );

// 負数は 64 bit に符号拡張した 10 バイトの varint にする(int32 の符号化規則)
const varint = (n: number): number[] => {
  if (n < 0) {
    const low = n >>> 0;
    const bytes: number[] = [];
    for (let i = 0; i < 4; i++) bytes.push(((low >>> (7 * i)) & 0x7f) | 0x80);
    bytes.push((((low >>> 28) & 0x0f) | 0xf0) & 0xff);
    bytes.push(0xff, 0xff, 0xff, 0xff);
    bytes.push(0x01);
    return bytes;
  }
  const out: number[] = [];
  let v = n;
  do {
    const b = v % 128;
    v = Math.floor(v / 128);
    out.push(v > 0 ? b | 0x80 : b);
  } while (v > 0);
  return out;
};
const ld = (num: number, body: number[]) => [
  ...varint(num * 8 + 2),
  ...varint(body.length),
  ...body,
];
const vi = (num: number, n: number) => [...varint(num * 8), ...varint(n)];
const str = (s: string) => [...new TextEncoder().encode(s)];

const tripUpdateFeed = (stu: number[], timestamp = 1793426042): Uint8Array =>
  new Uint8Array([
    ...ld(1, [...ld(1, str('1.0')), ...vi(3, timestamp)]),
    ...ld(2, [
      ...ld(1, str('TU0')),
      ...ld(3, [...ld(1, ld(1, str('平日_a'))), ...ld(2, stu)]),
    ]),
  ]);

describe('decodeTripUpdates', () => {
  it('実データから便 ID・停車順・遅れ・生成時刻を読む', () => {
    const feed = decodeTripUpdates(fixture('gtfs-rt-trip-update.pb'));
    expect(feed.generatedAt).toBe(1793426042);
    expect(feed.entities).toHaveLength(21);
    expect(feed.entities[0]).toEqual({
      tripId: '土曜_14時50分_系統938',
      stopSequence: 2,
      delaySeconds: 177,
    });
    expect(feed.entities[1]).toMatchObject({
      stopSequence: 14,
      delaySeconds: 477,
    });
  });

  it('負の遅れ(10 バイトの varint)を読む', () => {
    const feed = decodeTripUpdates(
      tripUpdateFeed([...vi(1, 5), ...ld(2, vi(1, -90))]),
    );
    expect(feed.entities).toEqual([
      { tripId: '平日_a', stopSequence: 5, delaySeconds: -90 },
    ]);
  });

  it('到着の遅れを出発の遅れより優先し、どちらも無ければ 0', () => {
    const both = tripUpdateFeed([
      ...vi(1, 3),
      ...ld(2, vi(1, 10)),
      ...ld(3, vi(1, 99)),
    ]);
    expect(decodeTripUpdates(both).entities[0].delaySeconds).toBe(10);
    const none = tripUpdateFeed(vi(1, 3));
    expect(decodeTripUpdates(none).entities[0].delaySeconds).toBe(0);
  });

  it('知らない項目を読み飛ばす', () => {
    const feed = decodeTripUpdates(
      tripUpdateFeed([
        ...vi(1, 3),
        ...vi(9, 7),
        ...ld(10, str('x')),
        ...ld(2, [...vi(1, 20), ...vi(7, 1)]),
      ]),
    );
    expect(feed.entities[0]).toMatchObject({
      stopSequence: 3,
      delaySeconds: 20,
    });
  });

  it('壊れた入力では例外を投げる', () => {
    const good = fixture('gtfs-rt-trip-update.pb');
    expect(() => decodeTripUpdates(good.subarray(0, 30))).toThrow();
    expect(() =>
      decodeTripUpdates(new Uint8Array([0x0a, 0x05, 0x01])),
    ).toThrow();
    expect(() => decodeTripUpdates(new Uint8Array([0x80]))).toThrow();
  });
});

describe('decodeVehicles', () => {
  it('実データから便 ID・現在の停車順・状態・生成時刻を読む', () => {
    const feed = decodeVehicles(fixture('gtfs-rt-vehicle.pb'));
    expect(feed.generatedAt).toBe(1793426042);
    expect(feed.entities).toHaveLength(21);
    expect(feed.entities[0]).toEqual({
      tripId: '土曜_14時50分_系統938',
      currentStopSequence: 2,
      status: 'in_transit_to',
    });
  });

  it('current_status の各値を読み、無ければ in_transit_to', () => {
    const vehicle = (extra: number[]) =>
      new Uint8Array([
        ...ld(2, [
          ...ld(1, str('V')),
          ...ld(4, [...ld(1, ld(1, str('t'))), ...vi(3, 4), ...extra]),
        ]),
      ]);
    expect(decodeVehicles(vehicle(vi(4, 0))).entities[0].status).toBe(
      'incoming_at',
    );
    expect(decodeVehicles(vehicle(vi(4, 1))).entities[0].status).toBe(
      'stopped_at',
    );
    expect(decodeVehicles(vehicle([])).entities[0].status).toBe(
      'in_transit_to',
    );
  });
});
