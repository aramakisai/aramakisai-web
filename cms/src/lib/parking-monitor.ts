export interface MonitorWindow {
  readonly start: string;
  readonly end: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 受信(撮影時刻)・稼働監視・公開側(現在時刻)で同じ扱いにするため、判定はここ 1 か所に置く。
// 分単位に丸めるので 17:30:59 も内側
export function isWithinMonitorWindow(at: Date, window: MonitorWindow): boolean {
  const t = new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(11, 16);
  return window.start <= t && t <= window.end;
}

type SiblingCtx = { siblingData?: { start?: unknown; end?: unknown } };

const FORMAT_ERROR = 'HH:mm の形式で入力してください (例: 09:00)';

export function validateMonitorStart(value: unknown, { siblingData }: SiblingCtx): true | string {
  if (typeof value !== 'string' || !HHMM.test(value)) return FORMAT_ERROR;
  const end = siblingData?.end;
  return typeof end === 'string' && HHMM.test(end) && value >= end ? '開始は終了より前にしてください' : true;
}

export function validateMonitorEnd(value: unknown, { siblingData }: SiblingCtx): true | string {
  if (typeof value !== 'string' || !HHMM.test(value)) return FORMAT_ERROR;
  const start = siblingData?.start;
  return typeof start === 'string' && HHMM.test(start) && start >= value ? '終了は開始より後にしてください' : true;
}
