import { DurableObject } from 'cloudflare:workers';
import { handleRequest, handleScheduled } from './http';
import { DiscordQueue } from './discord';
import { nextAlarmAt, retryDelayMs, staleSince } from './reconnect';
import {
  applyDismiss,
  emptyRelayState,
  isReceiving,
  isReceptionLost,
  processReport,
  recordDiscordMessage,
  SILENCE_LIMIT_MS,
  toPayload,
  type QuakeNotice,
  type RelayState,
} from './relay-core';
import {
  isInPeriod,
  p2pHistoryUrl,
  readRelayConfig,
  type ChannelName,
  type QuakeEnv,
  type RelayConfig,
} from './relay-config';
import type {
  QuakeChannelStatus,
  QuakeRelayRpc,
  QuakeRelayStatus,
} from './rpc';
import { hasUnreceivedReport, normalizeMessage } from './upstream';

const STATE_KEY = 'state';
const P2P_PROBE_MS = 5 * 60_000;
const CONNECT_TIMEOUT_MS = 30_000;
const RELAY_NAME = 'signage-quake';
const HUB_NAME = 'signage-hub';
const CHANNELS: readonly ChannelName[] = ['p2p', 'wolfxEew', 'wolfxEqlist'];

// wrangler types は先頭の設定(ハブ)の Env だけを作るので、リレー自身の binding はここで足す
type QuakeWorkerEnv = Pick<Env, 'SIGNAGE_HUB'> &
  QuakeEnv & { QUAKE_RELAY: DurableObjectNamespace<QuakeRelay> };

interface Connection {
  ws: WebSocket | null;
  connecting: boolean;
  openedAt: number;
  lastReceivedAt: number | null;
  failures: number;
  retryAt: number;
  /** P2Pのみ: 上流にあるのに受け取っていない情報がある */
  missed: boolean;
  probedAt: number;
}

const newConnection = (): Connection => ({
  ws: null,
  connecting: false,
  openedAt: 0,
  lastReceivedAt: null,
  failures: 0,
  retryAt: 0,
  missed: false,
  probedAt: 0,
});

// fetch の Upgrade は http(s) スキームでしか受け付けない
const toHttpUrl = (url: string) => url.replace(/^ws(s?):/, 'http$1:');

const iso = (t: number | null) =>
  t === null ? null : new Date(t).toISOString();

export class QuakeRelay
  extends DurableObject<QuakeWorkerEnv>
  implements QuakeRelayRpc
{
  readonly #parsed = readRelayConfig(this.env);
  readonly #bootedAt = Date.now();
  readonly #conns: Record<ChannelName, Connection> = {
    p2p: newConnection(),
    wolfxEew: newConnection(),
    wolfxEqlist: newConnection(),
  };
  /** 起動時は真。デプロイの再起動で受信状態の通知を出さない */
  readonly #prevReceiving: Record<ChannelName, boolean> = {
    p2p: true,
    wolfxEew: true,
    wolfxEqlist: true,
  };
  #state: RelayState = emptyRelayState();
  #saved = '';
  #lock: Promise<unknown> = Promise.resolve();
  readonly #discord: DiscordQueue;

  constructor(ctx: DurableObjectState, env: QuakeWorkerEnv) {
    super(ctx, env);
    if (!this.#parsed.ok)
      console.warn(`quake: 設定不正: ${this.#parsed.reason}`);
    this.#discord = new DiscordQueue({
      webhookUrl: this.#parsed.ok
        ? this.#parsed.config.discordWebhookUrl
        : null,
      fetch: (input, init) => fetch(input, init),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      messageIdFor: (key) =>
        this.#state.eew.find(
          (r) =>
            r.eventId === key.eventId &&
            r.serial === key.serial &&
            r.cancelled === key.cancelled,
        )?.discordMessageId,
      saveMessageId: (key, id) =>
        this.#serial(async () => {
          this.#state = recordDiscordMessage(this.#state, key, id);
          await this.#persist();
        }),
    });
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RelayState>(STATE_KEY);
      if (stored) this.#state = stored;
      this.#saved = JSON.stringify(this.#state);
    });
  }

  // await 中に別の受信が割り込んで状態を上書きしないよう、状態を触る処理を1件ずつ通す
  #serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#lock.then(fn);
    this.#lock = run.catch(() => {});
    return run;
  }

  get #config(): RelayConfig {
    if (!this.#parsed.ok) throw new Error('quake: 設定不正');
    return this.#parsed.config;
  }

  async #persist(): Promise<void> {
    const next = JSON.stringify(this.#state);
    if (next === this.#saved) return;
    await this.ctx.storage.put(STATE_KEY, this.#state);
    this.#saved = next;
  }

  /** 保存→(変わったとき)publish→通知。publish の成否を返す */
  async #commit(notices: readonly QuakeNotice[]): Promise<boolean> {
    await this.#persist();
    const published = await this.#publishIfChanged();
    for (const notice of notices) this.#discord.enqueue(notice);
    return published;
  }

  async #publishIfChanged(): Promise<boolean> {
    const payload = toPayload(this.#state);
    const json = JSON.stringify(payload);
    if (json === this.#state.published) return true;
    // 一度も配信していない待機中の状態は、端末にとって何も変わらない
    if (this.#state.published === null && !payload.active) return true;
    try {
      await this.env.SIGNAGE_HUB.get(
        this.env.SIGNAGE_HUB.idFromName(HUB_NAME),
      ).publish({ feature: 'quake', payload, expiresAt: null });
    } catch (error) {
      console.warn('quake: publish failed', error);
      return false;
    }
    this.#state = { ...this.#state, published: json };
    await this.#persist();
    return true;
  }

  #receive(channel: ChannelName, raw: string, test: boolean): Promise<boolean> {
    return this.#serial(async () => {
      const report = normalizeMessage(channel, raw, { test });
      if (!report) return false;
      const out = processReport(this.#state, report, Date.now(), test);
      this.#state = out.state;
      await this.#commit(out.notices);
      return true;
    });
  }

  async #onMessage(channel: ChannelName, data: unknown): Promise<void> {
    const conn = this.#conns[channel];
    conn.lastReceivedAt = Date.now();
    conn.failures = 0;
    conn.missed = false;
    if (typeof data !== 'string') return;
    try {
      await this.#receive(channel, data, this.#config.test[channel]);
    } catch (error) {
      console.warn(`quake: ${channel} の処理に失敗`, error);
    }
  }

  #close(channel: ChannelName, ws: WebSocket | null): void {
    const conn = this.#conns[channel];
    if (!ws || conn.ws !== ws) return;
    conn.ws = null;
    conn.retryAt = Date.now() + retryDelayMs(conn.failures, Math.random);
    conn.failures += 1;
    try {
      ws.close(1000);
    } catch {
      // 既に閉じている
    }
  }

  async #connect(channel: ChannelName): Promise<void> {
    const conn = this.#conns[channel];
    conn.connecting = true;
    // 応答が無いと connecting のまま残り、その系統は再接続されない。
    // 接続後に abort が効くと確立済みの WebSocket に触れるおそれがあるので finally で必ず解除する
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CONNECT_TIMEOUT_MS);
    try {
      const res = await fetch(toHttpUrl(this.#config.urls[channel]), {
        headers: { Upgrade: 'websocket' },
        signal: abort.signal,
      });
      const ws = res.webSocket;
      if (!ws) throw new Error(`status ${res.status}`);
      ws.accept();
      conn.ws = ws;
      conn.openedAt = Date.now();
      ws.addEventListener(
        'message',
        (e) => void this.#onMessage(channel, e.data),
      );
      ws.addEventListener('close', () => this.#close(channel, ws));
      ws.addEventListener('error', () => this.#close(channel, ws));
    } catch (error) {
      console.warn(`quake: ${channel} に接続できない`, error);
      conn.retryAt = Date.now() + retryDelayMs(conn.failures, Math.random);
      conn.failures += 1;
    } finally {
      clearTimeout(timer);
      conn.connecting = false;
    }
  }

  #receiving(channel: ChannelName, now: number): boolean {
    const conn = this.#conns[channel];
    return isReceiving(
      channel,
      {
        connected: conn.ws !== null,
        lastReceivedAt: conn.lastReceivedAt,
        bootedAt: this.#bootedAt,
        missed: conn.missed,
      },
      now,
    );
  }

  // P2P は配信が無い時間が長くハートビートも無いので、無受信の長さでは断を判定できない。
  // 受信が途絶えたら履歴を引き、受け取っていない情報が上流にあるときだけ断とみなす
  async #probeP2p(now: number): Promise<void> {
    const conn = this.#conns.p2p;
    const since = Math.max(
      conn.lastReceivedAt ?? this.#bootedAt,
      this.#bootedAt,
    );
    if (now - since < P2P_PROBE_MS || now - conn.probedAt < P2P_PROBE_MS)
      return;
    conn.probedAt = now;
    try {
      const res = await fetch(p2pHistoryUrl(this.#config.urls.p2p));
      if (!res.ok) return;
      if (!hasUnreceivedReport(await res.json(), since)) return;
    } catch (error) {
      console.warn('quake: p2p の履歴を取得できない', error);
      return;
    }
    conn.missed = true;
    this.#close('p2p', conn.ws);
  }

  async ensure(): Promise<void> {
    if (!this.#parsed.ok) return;
    const config = this.#parsed.config;
    const now = Date.now();
    if (!isInPeriod(config, now)) {
      for (const channel of CHANNELS)
        this.#close(channel, this.#conns[channel].ws);
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const toConnect: ChannelName[] = [];
    for (const channel of CHANNELS) {
      const conn = this.#conns[channel];
      if (channel === 'p2p') await this.#probeP2p(now);
      else if (
        conn.ws &&
        now - staleSince(conn.lastReceivedAt, conn.openedAt) >
          SILENCE_LIMIT_MS[channel]
      ) {
        this.#close(channel, conn.ws);
      }
      if (!conn.ws && !conn.connecting && now >= conn.retryAt) {
        toConnect.push(channel);
      }
    }
    await Promise.allSettled(toConnect.map((c) => this.#connect(c)));

    await this.#serial(async () => {
      await this.#commit(this.#channelNotices(Date.now()));
    });

    await this.ctx.storage.setAlarm(
      nextAlarmAt(
        Date.now(),
        CHANNELS.filter((c) => !this.#conns[c].ws).map(
          (c) => this.#conns[c].retryAt,
        ),
      ),
    );
  }

  #channelNotices(now: number): QuakeNotice[] {
    const notices: QuakeNotice[] = [];
    for (const channel of CHANNELS) {
      const receiving = this.#receiving(channel, now);
      if (receiving === this.#prevReceiving[channel]) continue;
      this.#prevReceiving[channel] = receiving;
      notices.push({
        kind: 'channel',
        channel,
        receiving,
        lastReceivedAt: this.#conns[channel].lastReceivedAt,
        at: now,
      });
    }
    return notices;
  }

  async alarm(): Promise<void> {
    await this.ensure();
  }

  async status(): Promise<QuakeRelayStatus> {
    const config = this.#config;
    const now = Date.now();
    const channels = {} as Record<ChannelName, QuakeChannelStatus>;
    const receiving = {} as Record<ChannelName, boolean>;
    for (const channel of CHANNELS) {
      const conn = this.#conns[channel];
      receiving[channel] = this.#receiving(channel, now);
      channels[channel] = {
        connected: conn.ws !== null,
        lastReceivedAt: iso(conn.lastReceivedAt),
        receiving: receiving[channel],
        test: config.test[channel],
      };
    }
    const inPeriod = isInPeriod(config, now);
    return {
      inPeriod,
      period: {
        from: iso(config.activeFrom)!,
        until: iso(config.activeUntil)!,
      },
      alert: toPayload(this.#state),
      channels,
      unreachable: inPeriod && isReceptionLost(receiving),
      discord: this.#discord.status(),
    };
  }

  dismiss(by: string): ReturnType<QuakeRelayRpc['dismiss']> {
    return this.#serial(async () => {
      const out = applyDismiss(this.#state, Date.now(), by);
      this.#state = out.state;
      // 解除済みの状態は保ち、未送信は次の alarm が再送する
      if (!(await this.#commit(out.notices))) {
        return { ok: false as const, reason: 'publish_failed' as const };
      }
      return { ok: true as const, status: await this.status() };
    });
  }

  async inject(
    channel: ChannelName,
    raw: string,
  ): Promise<'accepted' | 'ignored'> {
    if (!this.#config.devInject) return 'ignored';
    return (await this.#receive(channel, raw, true)) ? 'accepted' : 'ignored';
  }
}

const relayStub = (env: QuakeWorkerEnv): QuakeRelayRpc =>
  env.QUAKE_RELAY.get(env.QUAKE_RELAY.idFromName(RELAY_NAME), {
    locationHint: 'apac',
  });

export default {
  fetch: (request, env) => handleRequest(request, env, () => relayStub(env)),
  scheduled: (_controller, env, ctx) => {
    ctx.waitUntil(handleScheduled(env, Date.now(), () => relayStub(env)));
  },
} satisfies ExportedHandler<QuakeWorkerEnv>;
