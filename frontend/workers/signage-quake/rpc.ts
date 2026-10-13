import type { SignageQuakePayload } from '../../src/lib/signage-quake';
import type { DiscordStatus } from './discord';
import type { ChannelName } from './relay-config';

export interface QuakeChannelStatus {
  readonly connected: boolean;
  readonly lastReceivedAt: string | null;
  readonly receiving: boolean;
  readonly test: boolean;
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

export interface QuakeRelayRpc {
  /** 期間内なら接続とalarmを確かめる。期間外は接続を閉じる */
  ensure(): Promise<void>;
  status(): Promise<QuakeRelayStatus>;
  /** 表示中でなければ何もしない(冪等) */
  dismiss(
    by: string,
  ): Promise<
    | { readonly ok: true; readonly status: QuakeRelayStatus }
    | { readonly ok: false; readonly reason: 'publish_failed' }
  >;
  /** 開発時のみ。試験モードの系統の受信として処理する */
  inject(channel: ChannelName, raw: string): Promise<'accepted' | 'ignored'>;
}
