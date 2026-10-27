export interface DeviceStatus {
  readonly rssi: number | null;
  readonly uptime: number | null;
  readonly resetReason: string | null;
  readonly failures: number | null;
  readonly firmware: string | null;
}

function intIn(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function matching(value: string | null, pattern: RegExp): string | null {
  return value !== null && pattern.test(value) ? value : null;
}

// 任意項目の不正は受信自体を止めない理由がないので、外れた項目だけ値なしにして例外は投げない
export function readDeviceStatus(headers: Headers): DeviceStatus {
  return {
    rssi: intIn(headers.get('x-device-rssi'), -127, 0),
    uptime: intIn(headers.get('x-device-uptime'), 0, 4294967295),
    resetReason: matching(headers.get('x-device-reset-reason'), /^[A-Z0-9_]{1,32}$/),
    failures: intIn(headers.get('x-device-failures'), 0, 1000000),
    firmware: matching(headers.get('x-device-firmware'), /^[\x20-\x7E]{1,64}$/),
  };
}
