import type { SignageSetting } from '@/cms-types';
import { toJstDateKey } from './event-day';

/** 試験内の開始日時 − 起点。実時刻が開催日なら、消し忘れた設定で本番表示がずれないよう null */
export function trialShiftMs(
  trial: SignageSetting['trial_run'] | null | undefined,
  eventDayStartAts: readonly string[],
  realNowIso: string,
): number | null {
  if (!trial?.start_at || !trial.anchored_at) return null;
  const today = toJstDateKey(realNowIso);
  if (eventDayStartAts.some((at) => toJstDateKey(at) === today)) return null;
  return Date.parse(trial.start_at) - Date.parse(trial.anchored_at);
}

export interface SignageTouchClockMessage {
  readonly type: 'signage-touch-clock';
  readonly trialShiftMs: number | null;
}

export function isTouchClockMessage(
  data: unknown,
): data is SignageTouchClockMessage {
  if (typeof data !== 'object' || data === null) return false;
  const m = data as Record<string, unknown>;
  return (
    m.type === 'signage-touch-clock' &&
    (m.trialShiftMs === null || typeof m.trialShiftMs === 'number')
  );
}
