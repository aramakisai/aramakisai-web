import { DurableObject } from 'cloudflare:workers';
import {
  parseClientMessage,
  type SignageBroadcast,
  type SignagePinPayload,
  type SignagePublishInput,
} from '../../src/lib/signage-channel';
import {
  applyAlarm,
  applyPublish,
  emptyState,
  effectiveTargets,
  planConnect,
  planNotify,
  type HubState,
  type NotifyTarget,
} from './hub-core';

const STATE_KEY = 'state';

function parsePin(value: unknown): SignagePinPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const { slide, visibleSlideIds } = value as Record<string, unknown>;
  if (
    !Array.isArray(visibleSlideIds) ||
    !visibleSlideIds.every((id) => typeof id === 'number')
  ) {
    return null;
  }
  if (
    slide !== null &&
    (typeof slide !== 'object' ||
      typeof (slide as { id?: unknown }).id !== 'number')
  ) {
    return null;
  }
  // serverNow はハブが pong で配るので、取り直しのたびに変わる値を比較に混ぜない
  return { slide, visibleSlideIds } as SignagePinPayload;
}

export class SignageHub extends DurableObject<Env> {
  private hub: HubState = emptyState();
  private saved = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // hibernation から起きるたびにコンストラクタが走るので、保持と保留はストレージから読み直す
    void ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<HubState>(STATE_KEY);
      if (stored) this.hub = stored;
      this.saved = JSON.stringify(this.hub);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    const plan = planConnect(this.hub, Date.now());
    this.hub = plan.state;
    for (const message of plan.messages) server.send(JSON.stringify(message));
    if (plan.alarmAt !== null) await this.setAlarmEarlier(plan.alarmAt);
    await this.persist();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;
    const ping = parseClientMessage(message);
    if (!ping) return;
    ws.send(
      JSON.stringify({
        kind: 'pong',
        id: ping.id,
        serverNow: new Date().toISOString(),
      }),
    );
  }

  webSocketClose(ws: WebSocket, code: number): void {
    // 1005 などの予約コードは close の引数に使えないため、明示のコードで閉じ返す
    ws.close(
      code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006
        ? code
        : 1000,
    );
  }

  webSocketError(ws: WebSocket): void {
    ws.close(1011);
  }

  async notify(targets: readonly NotifyTarget[]): Promise<void> {
    const plan = planNotify(
      this.hub,
      targets,
      await this.ctx.storage.getAlarm(),
      Date.now(),
    );
    this.hub = plan.state;
    await this.ctx.storage.setAlarm(plan.alarmAt);
    await this.persist();
  }

  async publish(
    input: Exclude<SignagePublishInput, { feature: 'pin' | 'snapshot' }>,
  ): Promise<void> {
    const { state, broadcast } = applyPublish(this.hub, input, Date.now());
    this.hub = state;
    if (broadcast) this.broadcast([broadcast]);
    await this.persist();
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const pin = effectiveTargets(this.hub).includes('pin')
      ? await this.fetchPin()
      : null;
    const result = applyAlarm(this.hub, {
      now,
      pin,
      connections: this.ctx.getWebSockets().length,
    });
    this.hub = result.state;
    this.broadcast(result.broadcasts);
    if (result.alarmAt !== null)
      await this.ctx.storage.setAlarm(result.alarmAt);
    await this.persist();
  }

  private async fetchPin(): Promise<SignagePinPayload | 'failed'> {
    try {
      const res = await this.env.SITE.fetch(
        'https://site.internal/api/signage/pin',
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      const pin = parsePin(await res.json());
      if (!pin) throw new Error('unexpected shape');
      return pin;
    } catch (error) {
      console.warn('signage-hub: pin fetch failed', error);
      return 'failed';
    }
  }

  private broadcast(messages: readonly SignageBroadcast[]): void {
    for (const message of messages) {
      const text = JSON.stringify(message);
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(text);
        } catch {
          // 閉じかけの接続は webSocketClose / webSocketError が片付ける
        }
      }
    }
  }

  private async setAlarmEarlier(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || at < current) await this.ctx.storage.setAlarm(at);
  }

  private async persist(): Promise<void> {
    const next = JSON.stringify(this.hub);
    if (next === this.saved) return;
    await this.ctx.storage.put(STATE_KEY, this.hub);
    this.saved = next;
  }
}

export default {
  fetch: () => new Response('Not Found', { status: 404 }),
} satisfies ExportedHandler<Env>;
