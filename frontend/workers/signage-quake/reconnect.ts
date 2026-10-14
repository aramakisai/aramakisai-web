export const ALARM_INTERVAL_MS = 30_000;
const BASE_MS = 1000;
const MAX_MS = 60_000;

/** failures は連続した失敗の回数(0 なら1秒)。random は [0,1) */
export function retryDelayMs(failures: number, random: () => number): number {
  const base = Math.min(MAX_MS, BASE_MS * 2 ** Math.min(failures, 10));
  return Math.min(MAX_MS, Math.round(base * (0.8 + random() * 0.4)));
}

/** 再試行の時刻が近ければ、30秒を待たずにその時刻に起こす */
export function nextAlarmAt(
  now: number,
  retryTimes: readonly number[],
): number {
  return Math.max(now, Math.min(now + ALARM_INTERVAL_MS, ...retryTimes));
}

/**
 * 無受信の接続を閉じるかの基準。再接続した直後に古い受信時刻で閉じ直さないよう、
 * 接続した時刻と遅いほうを取る
 */
export function staleSince(
  lastReceivedAt: number | null,
  openedAt: number,
): number {
  return Math.max(lastReceivedAt ?? 0, openedAt);
}
