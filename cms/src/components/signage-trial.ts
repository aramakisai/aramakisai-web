import type { TrialRunValue } from '../lib/signage-trial';

const URL = '/api/globals/signage_settings?depth=0';
const STOPPED: TrialRunValue = { start_at: null, anchored_at: null };

const toValue = (v: Partial<TrialRunValue> | null | undefined): TrialRunValue =>
  v ? { start_at: v.start_at ?? null, anchored_at: v.anchored_at ?? null } : STOPPED;

export async function fetchTrial(f: typeof fetch = fetch): Promise<TrialRunValue> {
  const res = await f(URL, { credentials: 'include' });
  if (!res.ok) throw new Error('試験運転の状態を取得できませんでした');
  return toValue((await res.json()).trial_run);
}

// startAt: 開始・開始し直しは日時、終了は null
export async function saveTrial(startAt: string | null, f: typeof fetch = fetch): Promise<TrialRunValue> {
  const res = await f(URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trial_run: { start_at: startAt } }),
  });
  if (!res.ok) throw new Error('試験運転を更新できませんでした');
  return toValue((await res.json()).result?.trial_run);
}
