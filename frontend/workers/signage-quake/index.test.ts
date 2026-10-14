import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));

const { QuakeRelay } = await import('./index');

const IN_PERIOD = Date.parse('2026-10-24T00:00:00+09:00');
const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

class FakeSocket {
  listeners = new Map<string, ((e: unknown) => void)[]>();
  closed = false;
  accept = vi.fn();
  close = vi.fn(() => {
    this.closed = true;
  });
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  emit(type: string, e: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
}

function setup(envOver: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>();
  const storage = {
    alarm: null as number | null,
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
    getAlarm: async () => storage.alarm,
    setAlarm: async (at: number) => {
      storage.alarm = at;
    },
    deleteAlarm: async () => {
      storage.alarm = null;
    },
  };
  const ctx = {
    storage,
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
  };
  const publish = vi.fn<(input: unknown) => Promise<void>>(async () => {});
  const env = {
    QUAKE_ACTIVE_FROM: '2026-10-23T09:00:00+09:00',
    QUAKE_ACTIVE_UNTIL: '2026-11-22T00:00:00+09:00',
    SIGNAGE_QUAKE_TOKEN: 't',
    SIGNAGE_HUB: { idFromName: () => 'id', get: () => ({ publish }) },
    ...envOver,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = () => new QuakeRelay(ctx as any, env as any);
  return { make, storage, store, publish };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(IN_PERIOD);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('inject と publish', () => {
  it('警報を投入するとhubにquakeが出て、状態に反映され、保存される', async () => {
    const { make, publish, store } = setup({ QUAKE_DEV_INJECT: 'true' });
    const relay = make();
    expect(
      await relay.inject(
        'wolfxEew',
        fixture('hand-wolfx-eew-gunma-warning.json'),
      ),
    ).toBe('accepted');
    expect(publish).toHaveBeenCalledTimes(1);
    const input = publish.mock.calls[0][0] as {
      feature: string;
      expiresAt: null;
      payload: { active: boolean; stage: string; training: boolean };
    };
    expect(input).toMatchObject({ feature: 'quake', expiresAt: null });
    expect(input.payload).toMatchObject({ active: true, stage: 'warning' });
    expect((await relay.status()).alert).toMatchObject({ active: true });
    expect((store.get('state') as { published: string }).published).toContain(
      '"active":true',
    );
  });

  it('解釈できない入力は捨て、変化が無ければ再publishしない', async () => {
    const { make, publish } = setup({ QUAKE_DEV_INJECT: 'true' });
    const relay = make();
    expect(await relay.inject('p2p', fixture('broken.txt'))).toBe('ignored');
    const warning = fixture('hand-wolfx-eew-gunma-warning.json');
    await relay.inject('wolfxEew', warning);
    await relay.inject('wolfxEew', warning);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('QUAKE_DEV_INJECT が無ければ投入を無視する', async () => {
    const { make, publish } = setup();
    expect(
      await make().inject(
        'wolfxEew',
        fixture('hand-wolfx-eew-gunma-warning.json'),
      ),
    ).toBe('ignored');
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishに失敗しても状態は保存し、次のensureで再送する', async () => {
    const { make, publish, storage } = setup({ QUAKE_DEV_INJECT: 'true' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 502, webSocket: null })),
    );
    const relay = make();
    publish.mockRejectedValueOnce(new Error('down'));
    await relay.inject(
      'wolfxEew',
      fixture('hand-wolfx-eew-gunma-warning.json'),
    );
    expect(publish).toHaveBeenCalledTimes(1);
    await relay.ensure();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(storage.alarm).not.toBeNull();
  });

  it('解除はpublish失敗で失敗を返し、解除済みのまま保つ', async () => {
    const { make, publish } = setup({ QUAKE_DEV_INJECT: 'true' });
    const relay = make();
    await relay.inject(
      'wolfxEew',
      fixture('hand-wolfx-eew-gunma-warning.json'),
    );
    publish.mockRejectedValueOnce(new Error('down'));
    expect(await relay.dismiss('担当者')).toEqual({
      ok: false,
      reason: 'publish_failed',
    });
    expect((await relay.status()).alert).toEqual({ active: false });
    const again = await relay.dismiss('担当者');
    expect(again.ok).toBe(true);
    expect(publish).toHaveBeenLastCalledWith({
      feature: 'quake',
      payload: { active: false },
      expiresAt: null,
    });
  });

  it('再起動後に保存した状態を読み込む', async () => {
    const { make } = setup({ QUAKE_DEV_INJECT: 'true' });
    await make().inject(
      'wolfxEew',
      fixture('hand-wolfx-eew-gunma-warning.json'),
    );
    const restarted = make();
    // 本物の DO は blockConcurrencyWhile が読み込みを待つ
    await vi.advanceTimersByTimeAsync(0);
    expect((await restarted.status()).alert).toMatchObject({ active: true });
  });
});

describe('接続', () => {
  function stubSockets() {
    const sockets: { url: string; ws: FakeSocket }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const ws = new FakeSocket();
        sockets.push({ url, ws });
        return { status: 101, webSocket: ws };
      }),
    );
    return sockets;
  }

  it('期間内は3系統に1本ずつ接続し、alarmを張る', async () => {
    const { make, storage } = setup({
      QUAKE_P2P_URL: 'wss://sandbox.example/v2/ws',
    });
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    expect(sockets.map((s) => s.url)).toEqual([
      'https://sandbox.example/v2/ws',
      'https://ws-api.wolfx.jp/jma_eew',
      'https://ws-api.wolfx.jp/jma_eqlist',
    ]);
    expect(storage.alarm).toBe(IN_PERIOD + 30_000);
    await relay.ensure();
    expect(sockets).toHaveLength(3);
    const st = await relay.status();
    expect(st.channels.p2p).toMatchObject({ connected: true, test: true });
    expect(st.channels.wolfxEew.test).toBe(false);
  });

  it('期間外は接続せず、接続中なら閉じてalarmを消す', async () => {
    const { make, storage } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    vi.setSystemTime(Date.parse('2026-11-22T00:00:00+09:00'));
    await relay.ensure();
    expect(sockets.every((s) => s.ws.closed)).toBe(true);
    expect(storage.alarm).toBeNull();

    const outside = setup({ QUAKE_ACTIVE_UNTIL: '2026-10-23T10:00:00+09:00' });
    const none = stubSockets();
    await outside.make().ensure();
    expect(none).toHaveLength(0);
  });

  it('設定が不正なら接続しない', async () => {
    const { make } = setup({ QUAKE_ACTIVE_FROM: 'x' });
    const sockets = stubSockets();
    await make().ensure();
    expect(sockets).toHaveLength(0);
  });

  it('1系統の失敗は他に影響せず、待ちの後に再接続する', async () => {
    const { make } = setup();
    const ok: FakeSocket[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('jma_eew')) throw new Error('refused');
        const ws = new FakeSocket();
        ok.push(ws);
        return { status: 101, webSocket: ws };
      }),
    );
    const relay = make();
    await relay.ensure();
    expect(ok).toHaveLength(2);
    expect((await relay.status()).channels.wolfxEew.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    await relay.ensure();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('closeされた系統は再試行の待ちを過ぎてから再接続する', async () => {
    const { make } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    sockets[1].ws.emit('close');
    await relay.ensure();
    expect(sockets).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1300);
    await relay.ensure();
    expect(sockets).toHaveLength(4);
  });

  it('無受信が閾値を超えた開いた接続は閉じて再接続の待ちに入れる', async () => {
    const { make } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await relay.ensure();
    expect(sockets[1].ws.closed).toBe(true);
    expect(sockets[0].ws.closed).toBe(false);
  });

  it('受信すると最終受信時刻が付く', async () => {
    const { make } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    sockets[1].ws.emit('message', { data: fixture('wolfx-heartbeat.json') });
    await vi.advanceTimersByTimeAsync(0);
    expect((await relay.status()).channels.wolfxEew.lastReceivedAt).toBe(
      new Date(IN_PERIOD).toISOString(),
    );
  });
});
