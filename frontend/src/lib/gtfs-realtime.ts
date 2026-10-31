export interface RealtimeTripUpdate {
  tripId: string;
  stopSequence: number;
  delaySeconds: number;
}

export type RealtimeVehicleStatus =
  'incoming_at' | 'stopped_at' | 'in_transit_to';

export interface RealtimeVehicle {
  tripId: string;
  currentStopSequence: number;
  status: RealtimeVehicleStatus;
}

export interface RealtimeFeed<T> {
  generatedAt: number;
  entities: readonly T[];
}

const decoder = new TextDecoder('utf-8', { fatal: true });

// proto2 の列挙型の既定値は定義順の先頭ではなく IN_TRANSIT_TO(2)。
// フィードが current_status を省くとこの値を意味する。
const STATUS_BY_CODE: readonly RealtimeVehicleStatus[] = [
  'incoming_at',
  'stopped_at',
  'in_transit_to',
];

interface Field {
  num: number;
  wire: number;
  /** varint の値。int32 の負数は 64 bit に符号拡張されるため下位 32 bit だけを使う */
  low: number;
  /** varint を double で表した値。epoch 秒など 2^53 未満の符号なし整数用 */
  value: number;
  bytes: Uint8Array;
}

function fail(): never {
  throw new Error('GTFS-RT のデータが壊れています');
}

function* fields(buf: Uint8Array): Generator<Field> {
  let pos = 0;

  const varint = (): { low: number; value: number } => {
    let low = 0;
    let value = 0;
    for (let i = 0; i < 10; i++) {
      if (pos >= buf.length) fail();
      const b = buf[pos++];
      if (i < 5) low |= (b & 0x7f) << (7 * i);
      if (i < 8) value += (b & 0x7f) * 2 ** (7 * i);
      if ((b & 0x80) === 0) return { low: low | 0, value };
    }
    return fail();
  };

  const skip = (n: number): Uint8Array => {
    if (n < 0 || pos + n > buf.length) fail();
    const out = buf.subarray(pos, pos + n);
    pos += n;
    return out;
  };

  const empty = new Uint8Array(0);
  while (pos < buf.length) {
    const tag = varint().value;
    const num = Math.floor(tag / 8);
    const wire = tag % 8;
    if (num === 0) fail();
    if (wire === 0) {
      const v = varint();
      yield { num, wire, low: v.low, value: v.value, bytes: empty };
    } else if (wire === 2) {
      yield {
        num,
        wire,
        low: 0,
        value: 0,
        bytes: skip(varint().value),
      };
    } else if (wire === 1) {
      skip(8);
    } else if (wire === 5) {
      skip(4);
    } else {
      fail();
    }
  }
}

function text(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes);
  } catch {
    return fail();
  }
}

function readDelay(msg: Uint8Array): number | undefined {
  for (const f of fields(msg)) {
    if (f.num === 1 && f.wire === 0) return f.low;
  }
  return undefined;
}

function readTripId(msg: Uint8Array): string {
  for (const f of fields(msg)) {
    if (f.num === 1 && f.wire === 2) return text(f.bytes);
  }
  return '';
}

function decodeFeed<T>(
  bytes: Uint8Array,
  entityField: number,
  readEntity: (msg: Uint8Array) => T[],
): RealtimeFeed<T> {
  let generatedAt = 0;
  const entities: T[] = [];
  for (const f of fields(bytes)) {
    if (f.num === 1 && f.wire === 2) {
      for (const h of fields(f.bytes)) {
        if (h.num === 3 && h.wire === 0) generatedAt = h.value;
      }
    } else if (f.num === 2 && f.wire === 2) {
      for (const e of fields(f.bytes)) {
        if (e.num === entityField && e.wire === 2) {
          entities.push(...readEntity(e.bytes));
        }
      }
    }
  }
  return { generatedAt, entities };
}

export function decodeTripUpdates(
  bytes: Uint8Array,
): RealtimeFeed<RealtimeTripUpdate> {
  return decodeFeed(bytes, 3, (msg) => {
    let tripId = '';
    const updates: RealtimeTripUpdate[] = [];
    for (const f of fields(msg)) {
      if (f.num === 1 && f.wire === 2) tripId = readTripId(f.bytes);
      else if (f.num === 2 && f.wire === 2) {
        let stopSequence = 0;
        let arrival: number | undefined;
        let departure: number | undefined;
        for (const s of fields(f.bytes)) {
          if (s.num === 1 && s.wire === 0) stopSequence = s.value;
          else if (s.num === 2 && s.wire === 2) arrival = readDelay(s.bytes);
          else if (s.num === 3 && s.wire === 2) departure = readDelay(s.bytes);
        }
        updates.push({
          tripId,
          stopSequence,
          delaySeconds: arrival ?? departure ?? 0,
        });
      }
    }
    // trip(1) が stop_time_update(2) より後ろに来ても trip_id を反映する
    return updates.map((u) => ({ ...u, tripId }));
  });
}

export function decodeVehicles(
  bytes: Uint8Array,
): RealtimeFeed<RealtimeVehicle> {
  return decodeFeed(bytes, 4, (msg) => {
    let tripId = '';
    let currentStopSequence = 0;
    let status: RealtimeVehicleStatus = 'in_transit_to';
    for (const f of fields(msg)) {
      if (f.num === 1 && f.wire === 2) tripId = readTripId(f.bytes);
      else if (f.num === 3 && f.wire === 0) currentStopSequence = f.value;
      else if (f.num === 4 && f.wire === 0) {
        status = STATUS_BY_CODE[f.value] ?? status;
      }
    }
    return tripId === '' ? [] : [{ tripId, currentStopSequence, status }];
  });
}
