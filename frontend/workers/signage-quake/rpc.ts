import type { SignageQuakePayload } from '../../src/lib/signage-quake';
import type { DiscordStatus } from './discord';
import type { ChannelName } from './relay-config';

export interface QuakeChannelStatus {
  readonly connected: boolean;
  readonly lastReceivedAt: string | null;
  readonly receiving: boolean;
  readonly test: boolean;
  readonly failures: number;
  readonly retryAt: string | null;
  readonly lastClose: {
    readonly at: string;
    readonly code: number | null;
    readonly reason: string;
    readonly cause: string;
  } | null;
}

export interface QuakeRelayStatus {
  readonly inPeriod: boolean;
  readonly period: { readonly from: string; readonly until: string };
  readonly alert: SignageQuakePayload;
  readonly channels: Readonly<Record<ChannelName, QuakeChannelStatus>>;
  /** 期間内で、P2PとWolfx(jma_eew)がともに受信できていない */
  readonly unreachable: boolean;
  readonly discord: DiscordStatus;
}

export interface QuakeRelayCronStatus {
  /** cron が最後に cronTick を呼んだ時刻 */
  readonly lastRunAt: string | null;
}

export interface QuakeRelayStatusV2 extends QuakeRelayStatus {
  readonly cron: QuakeRelayCronStatus;
}

export interface QuakeRelayRpc {
  /** 期間内なら接続とalarmを確かめる。期間外は接続を閉じる */
  ensure(): Promise<void>;
  /** cron 経路の ensure。最終実行時刻を記録してから ensure を呼ぶ */
  cronTick(): Promise<void>;
  status(): Promise<QuakeRelayStatusV2>;
  /** 表示中でなければ何もしない(冪等) */
  dismiss(
    by: string,
  ): Promise<
    | { readonly ok: true; readonly status: QuakeRelayStatusV2 }
    | { readonly ok: false; readonly reason: 'publish_failed' }
  >;
  /** 開発時のみ。試験モードの系統の受信として処理する */
  inject(channel: ChannelName, raw: string): Promise<'accepted' | 'ignored'>;
}
