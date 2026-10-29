import type { StampEnv } from './cloudflare-env';
import type { D1Usage } from './stamp-db';

export type MetricEndpoint =
  | 'verify'
  | 'stamps'
  | 'exchange_token'
  | 'staff_dashboard'
  | 'staff_visitor'
  | 'staff_exchanges'
  | 'staff_register'
  | 'staff_cancel';

export interface RequestMeasure {
  readonly endpoint: MetricEndpoint;
  readonly outcome: string;
  readonly status: number;
  readonly requestBytes: number;
  readonly responseBytes: number;
  readonly totalMs: number;
  readonly usage: D1Usage | null;
  readonly d1Failed?: boolean;
  readonly exhibitionId?: number;
  readonly category?: string;
}

export function recordRequest(env: StampEnv, m: RequestMeasure): void {
  try {
    env.STAMP_METRICS.writeDataPoint({
      indexes: [m.endpoint],
      blobs: [
        env.STAMP_ENV,
        m.endpoint,
        m.outcome,
        String(m.status),
        m.exhibitionId === undefined ? '' : String(m.exhibitionId),
        m.category ?? '',
      ],
      doubles: [
        m.requestBytes,
        m.responseBytes,
        m.totalMs,
        m.usage?.durationMs ?? 0,
        m.usage?.rowsRead ?? 0,
        m.usage?.rowsWritten ?? 0,
        m.d1Failed ? 1 : 0,
      ],
    });
  } catch {
    // 計測の失敗で来場者の操作を落とさない
  }
}
