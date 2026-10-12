import { useEffect, useState } from 'react';
import {
  isExpired,
  parseServerMessage,
  SIGNAGE_PING_INTERVAL_MS,
  SIGNAGE_PONG_TIMEOUT_MS,
  type SignageBroadcast,
  type SignageClientMessage,
  type SignageFeature,
  type SignageFeaturePayloads,
  type SignagePinPayload,
} from './signage-channel';
import { clockOffsetMs } from './signage-time';

export interface SignageChannelState {
  readonly pin: SignagePinPayload | undefined;
  readonly snapshotVersion: number | undefined;
  /** 最後に得たずれ。一度も pong を受けていなければ null */
  readonly offsetMs: number | null;
  /** 機能名ごとの最後の broadcast(期限切れは受信時に捨てる) */
  readonly latest: Partial<{
    readonly [F in SignageFeature]: Extract<SignageBroadcast, { feature: F }>;
  }>;
}

const INITIAL: SignageChannelState = {
  pin: undefined,
  snapshotVersion: undefined,
  offsetMs: null,
  latest: {},
};

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_JITTER = 0.2;

type Timer = ReturnType<typeof setTimeout> | undefined;

export function useSignageChannel(): SignageChannelState {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/signage/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: Timer;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pongTimer: Timer;
    let attempt = 0;
    let nextPingId = 0;
    let offsetMs: number | null = null;
    const sentAt = new Map<number, number>();

    const stopSocket = () => {
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
      pongTimer = undefined;
      sentAt.clear();
      if (ws) {
        // 古い接続の遅れた受信・close が新しい接続の状態を壊さないよう先にハンドラを外す
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        ws.close();
        ws = null;
      }
    };

    const connect = () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      stopSocket();
      const sock = new WebSocket(url);
      ws = sock;
      sock.onopen = () => {
        ping();
        pingTimer = setInterval(ping, SIGNAGE_PING_INTERVAL_MS);
      };
      sock.onmessage = (e) => {
        if (typeof e.data === 'string') receive(e.data);
      };
      sock.onclose = sock.onerror = lost;
    };

    const lost = () => {
      stopSocket();
      if (reconnectTimer !== undefined) return;
      const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
      attempt++;
      const jitter = 1 + (Math.random() * 2 - 1) * BACKOFF_JITTER;
      reconnectTimer = setTimeout(connect, base * jitter);
    };

    const ping = () => {
      if (!ws) return;
      const id = ++nextPingId;
      sentAt.set(id, Date.now());
      const msg: SignageClientMessage = { kind: 'ping', id };
      ws.send(JSON.stringify(msg));
      pongTimer ??= setTimeout(lost, SIGNAGE_PONG_TIMEOUT_MS);
    };

    const receive = (raw: string) => {
      const msg = parseServerMessage(raw);
      if (!msg) return;
      if (msg.kind === 'pong') {
        const sent = sentAt.get(msg.id);
        if (sent === undefined) return;
        sentAt.delete(msg.id);
        clearTimeout(pongTimer);
        pongTimer = undefined;
        attempt = 0;
        const next = clockOffsetMs(msg.serverNow, sent, Date.now());
        if (Number.isNaN(next)) return;
        offsetMs = next;
        setState((s) => ({ ...s, offsetMs: next }));
        return;
      }
      if (isExpired(msg, Date.now() + (offsetMs ?? 0))) return;
      setState((s) => {
        const latest = { ...s.latest, [msg.feature]: msg };
        return {
          ...s,
          latest,
          pin: latest.pin?.payload,
          snapshotVersion: latest.snapshot?.payload.version,
        };
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        stopSocket();
      } else {
        connect();
      }
    };
    // 待ちの最中だけ打ち切る。接続中・接続済みのときに張り直すと1本の原則が崩れる
    const onOnline = () => {
      if (reconnectTimer !== undefined) connect();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    if (document.visibilityState !== 'hidden') connect();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      clearTimeout(reconnectTimer);
      stopSocket();
    };
  }, []);

  return state;
}

/** 補正済みの now で期限切れなら undefined。他機能の部品はこれで payload を読む */
export function useSignageFeature<F extends SignageFeature>(
  state: SignageChannelState,
  feature: F,
  now: Date,
): SignageFeaturePayloads[F] | undefined {
  const message = state.latest[feature] as
    Extract<SignageBroadcast, { feature: F }> | undefined;
  if (!message || isExpired(message, now.getTime())) return undefined;
  return message.payload as SignageFeaturePayloads[F];
}
