/** リレー(別ワークスペースの Worker)が返す状態。frontend/workers/signage-quake と同じ形をここに持つ */
export type QuakeStage = 'warning' | 'calm' | 'evacuate' | 'cancelled';
export type QuakeSource = 'p2p' | 'wolfx';

export interface QuakeObservation {
  readonly source: QuakeSource;
  readonly originTime: string;
  readonly hypocenter: string;
  readonly maebashiIntensity: string | null;
  readonly maxIntensity: string | null;
}

export type QuakeAlert =
  | { readonly active: false }
  | {
      readonly active: true;
      readonly stage: QuakeStage;
      readonly training: boolean;
      readonly source: QuakeSource;
      readonly startedAt: string;
      readonly updatedAt: string;
      readonly observation: QuakeObservation | null;
    };

export type QuakeChannelName = 'p2p' | 'wolfxEew' | 'wolfxEqlist';

export interface QuakeChannelStatus {
  readonly connected: boolean;
  readonly lastReceivedAt: string | null;
  readonly receiving: boolean;
  readonly test: boolean;
}

export interface QuakeDiscordStatus {
  readonly configured: boolean;
  readonly disabled: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastFailure: string | null;
}

export interface QuakeRelayStatus {
  readonly inPeriod: boolean;
  readonly period: { readonly from: string; readonly until: string };
  readonly alert: QuakeAlert;
  readonly channels: Readonly<Record<QuakeChannelName, QuakeChannelStatus>>;
  readonly unreachable: boolean;
  readonly discord: QuakeDiscordStatus;
}

export type RelayConfig = { readonly url: string; readonly token: string };

const TIMEOUT_MS = 3_000;

export function readRelayConfig(env: Record<string, string | undefined> = process.env): RelayConfig | null {
  const url = env.SIGNAGE_QUAKE_URL;
  const token = env.SIGNAGE_QUAKE_TOKEN;
  return url && token ? { url, token } : null;
}

/** 状態を返せたときだけ ok。不達・打ち切り・リレーの異常応答(401・502 など)はすべて unreachable にまとめる */
export async function callRelay(
  config: RelayConfig,
  path: '/status' | '/dismiss',
  by: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ readonly ok: true; readonly status: QuakeRelayStatus } | { readonly ok: false }> {
  try {
    const res = await fetchImpl(new URL(path, config.url), {
      method: path === '/dismiss' ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(by === null ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(by === null ? {} : { body: JSON.stringify({ by }) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false };
    return { ok: true, status: (await res.json()) as QuakeRelayStatus };
  } catch {
    return { ok: false };
  }
}
