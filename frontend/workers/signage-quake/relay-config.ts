export type ChannelName = 'p2p' | 'wolfxEew' | 'wolfxEqlist';

export const PRODUCTION_URLS: Readonly<Record<ChannelName, string>> = {
  p2p: 'wss://api.p2pquake.net/v2/ws',
  wolfxEew: 'wss://ws-api.wolfx.jp/jma_eew',
  wolfxEqlist: 'wss://ws-api.wolfx.jp/jma_eqlist',
};

const WEBHOOK_PREFIX = 'https://discord.com/api/webhooks/';

/** Worker の vars と秘密のうち、リレーが読むもの */
export interface QuakeEnv {
  readonly QUAKE_P2P_URL?: string;
  readonly QUAKE_WOLFX_EEW_URL?: string;
  readonly QUAKE_WOLFX_EQLIST_URL?: string;
  readonly QUAKE_ACTIVE_FROM?: string;
  readonly QUAKE_ACTIVE_UNTIL?: string;
  readonly QUAKE_DEV_INJECT?: string;
  readonly SIGNAGE_QUAKE_TOKEN?: string;
  readonly DISCORD_QUAKE_WEBHOOK_URL?: string;
}

export interface RelayConfig {
  readonly urls: Readonly<Record<ChannelName, string>>;
  /** 接続先が本番のURLと一致しない系統は試験モード */
  readonly test: Readonly<Record<ChannelName, boolean>>;
  readonly activeFrom: number;
  /** この時刻を含まない */
  readonly activeUntil: number;
  readonly devInject: boolean;
  readonly token: string;
  /** 未設定・形が不正ならnull(投稿しない) */
  readonly discordWebhookUrl: string | null;
}

export type ConfigResult =
  | { readonly ok: true; readonly config: RelayConfig }
  | { readonly ok: false; readonly reason: string };

function urlOf(configured: string | undefined, channel: ChannelName): string {
  return configured ? configured : PRODUCTION_URLS[channel];
}

export function readRelayConfig(env: QuakeEnv): ConfigResult {
  const activeFrom = Date.parse(env.QUAKE_ACTIVE_FROM ?? '');
  const activeUntil = Date.parse(env.QUAKE_ACTIVE_UNTIL ?? '');
  if (Number.isNaN(activeFrom) || Number.isNaN(activeUntil))
    return { ok: false, reason: '稼働期間を解釈できない' };
  if (activeUntil <= activeFrom)
    return { ok: false, reason: '稼働期間の終端が開始以前' };
  if (!env.SIGNAGE_QUAKE_TOKEN)
    return { ok: false, reason: 'トークンが未設定' };

  const urls: Record<ChannelName, string> = {
    p2p: urlOf(env.QUAKE_P2P_URL, 'p2p'),
    wolfxEew: urlOf(env.QUAKE_WOLFX_EEW_URL, 'wolfxEew'),
    wolfxEqlist: urlOf(env.QUAKE_WOLFX_EQLIST_URL, 'wolfxEqlist'),
  };

  const webhook = env.DISCORD_QUAKE_WEBHOOK_URL;
  let discordWebhookUrl: string | null = null;
  if (webhook) {
    if (
      webhook.startsWith(WEBHOOK_PREFIX) &&
      webhook.length > WEBHOOK_PREFIX.length
    )
      discordWebhookUrl = webhook;
    else console.warn('Webhookの設定が不正');
  }

  return {
    ok: true,
    config: {
      urls,
      test: {
        p2p: urls.p2p !== PRODUCTION_URLS.p2p,
        wolfxEew: urls.wolfxEew !== PRODUCTION_URLS.wolfxEew,
        wolfxEqlist: urls.wolfxEqlist !== PRODUCTION_URLS.wolfxEqlist,
      },
      activeFrom,
      activeUntil,
      devInject: env.QUAKE_DEV_INJECT === 'true',
      token: env.SIGNAGE_QUAKE_TOKEN,
      discordWebhookUrl,
    },
  };
}

export function isInPeriod(config: RelayConfig, now: number): boolean {
  return now >= config.activeFrom && now < config.activeUntil;
}
