export interface TrialRunValue {
  readonly start_at: string | null;
  readonly anchored_at: string | null;
}

export type TrialStartValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'no_event_days' | 'not_event_day' };

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const jstDate = (iso: string): string => new Date(Date.parse(iso) + JST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * nextStartAt: undefined = この保存で送られていない(前の値を保持)、null = 終了、string = 開始・開始し直し
 */
export function decideTrialAnchor(
  previous: TrialRunValue | null,
  nextStartAt: string | null | undefined,
  nowIso: string,
): TrialRunValue {
  if (nextStartAt === undefined) return previous ?? { start_at: null, anchored_at: null };
  if (nextStartAt === null) return { start_at: null, anchored_at: null };
  // 秒の整数倍にして、試験時刻と実時刻の秒の切り替わりを揃える
  const anchoredAt = new Date(Math.floor(Date.parse(nowIso) / 1000) * 1000).toISOString();
  return { start_at: nextStartAt, anchored_at: anchoredAt };
}

export function validateTrialStart(startAt: string, eventDayStartAts: readonly string[]): TrialStartValidation {
  if (eventDayStartAts.length === 0) return { ok: false, reason: 'no_event_days' };
  const day = jstDate(startAt);
  return eventDayStartAts.some((d) => jstDate(d) === day) ? { ok: true } : { ok: false, reason: 'not_event_day' };
}
