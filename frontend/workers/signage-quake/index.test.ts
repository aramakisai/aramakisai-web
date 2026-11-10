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

  it('上流が429なら60秒以上待ち、その前のensureでは再接続しない', async () => {
    const { make } = setup();
    const fetchMock = vi.fn(async () => ({ status: 429, webSocket: null }));
    vi.stubGlobal('fetch', fetchMock);
    const relay = make();
    await relay.ensure();
    const calls = fetchMock.mock.calls.length;
    const { retryAt } = (await relay.status()).channels.p2p;
    expect(Date.parse(retryAt as string)).toBeGreaterThanOrEqual(
      IN_PERIOD + 60_000,
    );
    vi.setSystemTime(IN_PERIOD + 59_000);
    await relay.ensure();
    expect(fetchMock.mock.calls.length).toBe(calls);
    vi.setSystemTime(IN_PERIOD + 90_000);
    await relay.ensure();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
  });

  it('429以外の失敗は従来のバックオフで再試行する', async () => {
    const { make } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 503, webSocket: null })),
    );
    const relay = make();
    await relay.ensure();
    const { retryAt } = (await relay.status()).channels.p2p;
    expect(Date.parse(retryAt as string)).toBeLessThanOrEqual(
      IN_PERIOD + 1_200,
    );
  });

  it('cronTick だけが記録し、alarm は更新しない', async () => {
    const { make } = setup();
    stubSockets();
    const relay = make();
    expect((await relay.status()).cron.lastRunAt).toBeNull();
    await relay.alarm();
    expect((await relay.status()).cron.lastRunAt).toBeNull();
    await relay.cronTick();
    expect((await relay.status()).cron.lastRunAt).toBe(
      new Date(IN_PERIOD).toISOString(),
    );
    vi.setSystemTime(IN_PERIOD + 60_000);
    await relay.alarm();
    expect((await relay.status()).cron.lastRunAt).toBe(
      new Date(IN_PERIOD).toISOString(),
    );
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

  it('上流が応答しなければタイムアウトで失敗扱いにし、待ちの後に再接続する', async () => {
    const { make } = setup();
    const fetchMock = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const relay = make();
    const first = relay.ensure();
    await vi.advanceTimersByTimeAsync(30_000);
    await first;
    expect(console.warn).toHaveBeenCalledWith(
      'quake: wolfxEew に接続できない: Error: aborted',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // connecting が解除されていれば待ちの後に再接続を試みる
    await vi.advanceTimersByTimeAsync(30_000);
    const second = relay.ensure();
    await vi.advanceTimersByTimeAsync(30_000);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(6);
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

  it('closeで理由をwarnに出し、/statusに切断情報を載せる', async () => {
    const { make } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    expect((await relay.status()).channels.wolfxEew).toMatchObject({
      failures: 0,
      retryAt: null,
      lastClose: null,
    });
    await vi.advanceTimersByTimeAsync(5000);
    sockets[1].ws.emit('message', { data: 'x' });
    await vi.advanceTimersByTimeAsync(1000);
    sockets[1].ws.emit('close', { code: 1006, reason: 'abnormal' });
    const warn = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
    expect(warn).toContainEqual(
      expect.stringMatching(
        /^quake: wolfxEew .*cause=upstream_close code=1006 reason="abnormal" openMs=6000 received=1/,
      ),
    );
    const ch = (await relay.status()).channels.wolfxEew;
    expect(ch.failures).toBe(1);
    expect(ch.retryAt).toEqual(expect.any(String));
    expect(ch.lastClose).toEqual({
      at: new Date(IN_PERIOD + 6000).toISOString(),
      code: 1006,
      reason: 'abnormal',
      cause: 'upstream_close',
    });
  });

  it('errorはmessageと契機を記録する', async () => {
    const { make } = setup();
    const sockets = stubSockets();
    const relay = make();
    await relay.ensure();
    sockets[1].ws.emit('error', { message: 'boom' });
    expect((await relay.status()).channels.wolfxEew.lastClose).toMatchObject({
      code: null,
      reason: 'boom',
      cause: 'error',
    });
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
    expect((await relay.status()).channels.wolfxEew.lastClose?.cause).toBe(
      'silence',
    );
  });

  describe('P2Pの取りこぼし判定', () => {
    const history = (time: string) => ({
      ok: true,
      json: async () => [{ code: 555, time }],
    });
    const jst = (t: number) =>
      new Date(t + 9 * 3600_000)
        .toISOString()
        .replace('T', ' ')
        .replace(/-/g, '/')
        .replace('Z', '');
    // p2p は history の取得先、他は WebSocket
    const stub = (respond: () => unknown) => {
      const sockets: FakeSocket[] = [];
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes('/history')) return respond();
        const ws = new FakeSocket();
        sockets.push(ws);
        return { status: 101, webSocket: ws };
      });
      vi.stubGlobal('fetch', fetchMock);
      return { sockets, fetchMock };
    };

    it('無受信50分でも上流に新しい情報が無ければ受信中で、閉じない', async () => {
      const { make } = setup();
      const { sockets } = stub(() => history(jst(IN_PERIOD - 1000)));
      const relay = make();
      await relay.ensure();
      await vi.advanceTimersByTimeAsync(50 * 60_000);
      await relay.ensure();
      expect(sockets[0].closed).toBe(false);
      expect((await relay.status()).channels.p2p.receiving).toBe(true);
    });

    it('上流に新しい情報があれば閉じて受信断にし、受信で戻る', async () => {
      const { make } = setup();
      const { sockets } = stub(() =>
        history(jst(IN_PERIOD + 6 * 60_000 - 1000)),
      );
      const relay = make();
      await relay.ensure();
      await vi.advanceTimersByTimeAsync(6 * 60_000);
      await relay.ensure();
      expect(sockets[0].closed).toBe(true);
      expect((await relay.status()).channels.p2p.receiving).toBe(false);
      await vi.advanceTimersByTimeAsync(60_000);
      await relay.ensure();
      for (const ws of sockets) ws.emit('message', { data: 'x' });
      await vi.advanceTimersByTimeAsync(0);
      expect((await relay.status()).channels.p2p.receiving).toBe(true);
    });

    it('履歴の取得に失敗しても状態を変えない', async () => {
      for (const respond of [
        () => {
          throw new Error('down');
        },
        () => ({ ok: false }),
        () => ({ ok: true, json: async () => 'broken' }),
      ]) {
        const { make } = setup();
        const { sockets } = stub(respond);
        const relay = make();
        await relay.ensure();
        await vi.advanceTimersByTimeAsync(6 * 60_000);
        await relay.ensure();
        expect(sockets[0].closed).toBe(false);
        expect((await relay.status()).channels.p2p.receiving).toBe(true);
      }
    });

    it('履歴の取得は5分以上あけ、受信直後は引かない', async () => {
      const { make } = setup();
      const { fetchMock } = stub(() => history('1999/01/01 00:00:00.000'));
      const relay = make();
      await relay.ensure();
      await vi.advanceTimersByTimeAsync(4 * 60_000);
      await relay.ensure();
      const calls = () =>
        fetchMock.mock.calls.filter(([u]) => u.includes('/history')).length;
      expect(calls()).toBe(0);
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      await relay.ensure();
      await vi.advanceTimersByTimeAsync(30_000);
      await relay.ensure();
      expect(calls()).toBe(1);
    });
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

describe('再起動をまたぐ受信状態', () => {
  const HOOK = 'https://discord.com/api/webhooks/1/x';

  // webhook への投稿本文を集める。wolfx は heartbeat で受信、p2p は history を返す
  function stub(history: () => unknown = () => ({ ok: false })) {
    const sockets: Record<string, FakeSocket> = {};
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { body?: string }) => {
        if (url.startsWith(HOOK)) {
          posts.push(JSON.parse(init!.body!).content);
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ id: '1' }),
          };
        }
        if (url.includes('/history')) return history();
        const ws = new FakeSocket();
        sockets[
          url.includes('jma_eew')
            ? 'wolfxEew'
            : url.includes('jma_eqlist')
              ? 'wolfxEqlist'
              : 'p2p'
        ] = ws;
        return { status: 101, webSocket: ws };
      }),
    );
    return { sockets, posts };
  }

  // 3分超の無受信でwolfxEewを不受信通知済みにし、再起動した新インスタンスを返す
  async function downThenRestart() {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    const first = stub();
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.posts.some((p) => p.includes('受信できていません'))).toBe(
      true,
    );
    const second = stub();
    const restarted = s.make();
    await vi.advanceTimersByTimeAsync(0);
    return { ...s, restarted, second };
  }

  it('不受信通知済みのまま再起動しても、同じ不受信通知を再送しない', async () => {
    const { restarted, second } = await downThenRestart();
    await restarted.ensure();
    // 起動直後の猶予(3分)を過ぎても再送しない
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.posts).toEqual([]);
  });

  it('不受信通知済みのまま再起動したら、猶予では再開にせず、実受信で再開を通知する', async () => {
    const { restarted, second } = await downThenRestart();
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(30_000);
    await restarted.ensure();
    expect((await restarted.status()).channels.wolfxEew.receiving).toBe(false);
    second.sockets.wolfxEew.emit('message', {
      data: fixture('wolfx-heartbeat.json'),
    });
    await vi.advanceTimersByTimeAsync(0);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.posts.filter((p) => p.includes('再開'))).toHaveLength(1);
    expect(
      second.posts.filter((p) => p.includes('できていません')),
    ).toHaveLength(0);
  });

  it('P2Pも復元したmissedにより、実受信まで不受信のまま', async () => {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    const jst = (t: number) =>
      new Date(t + 9 * 3600_000)
        .toISOString()
        .replace('T', ' ')
        .replace(/-/g, '/')
        .replace('Z', '');
    const first = stub(() => ({
      ok: true,
      json: async () => [
        { code: 555, time: jst(IN_PERIOD + 6 * 60_000 - 1000) },
      ],
    }));
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(6 * 60_000);
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.posts.some((p) => p.includes('受信できていません'))).toBe(
      true,
    );
    const second = stub();
    const restarted = s.make();
    await vi.advanceTimersByTimeAsync(0);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect((await restarted.status()).channels.p2p.receiving).toBe(false);
    expect(second.posts).toEqual([]);
    second.sockets.p2p.emit('message', { data: 'x' });
    await vi.advanceTimersByTimeAsync(0);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(second.posts.filter((p) => p.includes('再開'))).toHaveLength(1);
  });

  it('受信中の再起動は通知せず、起動直後の猶予も従来どおり', async () => {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    const first = stub();
    const relay = s.make();
    await relay.ensure();
    first.sockets.wolfxEew.emit('message', {
      data: fixture('wolfx-heartbeat.json'),
    });
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    await relay.ensure();
    const second = stub();
    const restarted = s.make();
    await vi.advanceTimersByTimeAsync(0);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 - 1000);
    await restarted.ensure();
    expect((await restarted.status()).channels.wolfxEew.receiving).toBe(true);
    expect(first.posts).toEqual([]);
    expect(second.posts).toEqual([]);
  });

  it('最後の受信時刻は再起動後も復元値を使う', async () => {
    const s = setup();
    const first = stub();
    const relay = s.make();
    await relay.ensure();
    first.sockets.wolfxEew.emit('message', {
      data: fixture('wolfx-heartbeat.json'),
    });
    await vi.advanceTimersByTimeAsync(0);
    // 保存済みの値を読み戻せるよう、受信から60秒以上あけて遷移の無い保存を起こす
    await vi.advanceTimersByTimeAsync(61_000);
    first.sockets.wolfxEew.emit('message', {
      data: fixture('wolfx-heartbeat.json'),
    });
    await vi.advanceTimersByTimeAsync(0);
    const restarted = s.make();
    await vi.advanceTimersByTimeAsync(0);
    expect((await restarted.status()).channels.wolfxEew.lastReceivedAt).toBe(
      new Date(IN_PERIOD + 61_000).toISOString(),
    );
  });

  it('failures と retryAt は永続化しない', async () => {
    const s = setup();
    const { sockets } = stub();
    await s.make().ensure();
    sockets.wolfxEew.emit('message', { data: fixture('wolfx-heartbeat.json') });
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(s.store.get('health'))).not.toMatch(
      /failures|retryAt/,
    );
  });

  it('受信の保存は系統ごとに60秒に1回へ間引く', async () => {
    const s = setup();
    const first = stub();
    const put = vi.spyOn(s.storage, 'put');
    const relay = s.make();
    await relay.ensure();
    const writes = () => put.mock.calls.filter(([k]) => k === 'health').length;
    const emit = async () => {
      first.sockets.wolfxEew.emit('message', {
        data: fixture('wolfx-heartbeat.json'),
      });
      await vi.advanceTimersByTimeAsync(0);
    };
    await emit();
    const n = writes();
    await vi.advanceTimersByTimeAsync(30_000);
    await emit();
    expect(writes()).toBe(n);
    await vi.advanceTimersByTimeAsync(31_000);
    await emit();
    expect(writes()).toBe(n + 1);
  });

  it('再接続直後の接続を、それ以前の履歴を理由に missed で閉じない', async () => {
    const s = setup();
    const jst = (t: number) =>
      new Date(t + 9 * 3600_000)
        .toISOString()
        .replace('T', ' ')
        .replace(/-/g, '/')
        .replace('Z', '');
    // 履歴は断の最中(再接続の直前)の時刻
    const { sockets } = stub(() => ({
      ok: true,
      json: async () => [{ code: 555, time: jst(IN_PERIOD + 90_000) }],
    }));
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(60_000);
    sockets.p2p.emit('close', { code: 1006, reason: '' });
    await vi.advanceTimersByTimeAsync(2000);
    await relay.ensure();
    const reopened = sockets.p2p;
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    await relay.ensure();
    expect(reopened.closed).toBe(false);
    expect((await relay.status()).channels.p2p.receiving).toBe(true);
  });

  it('受信状態の保存に失敗しても通知は出て、alarm も張る', async () => {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    const { posts } = stub();
    const put = s.storage.put;
    s.storage.put = async (k: string, v: unknown) => {
      if (k === 'health') throw new Error('storage down');
      return put(k, v);
    };
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(posts.some((p) => p.includes('受信できていません'))).toBe(true);
    expect(s.storage.alarm).not.toBeNull();
  });

  it('送信が成功する前に再起動したら、新インスタンスが同じ通知を出す', async () => {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    // webhook が応答しないまま再起動する
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith(HOOK)) return new Promise(() => {});
        return { status: 101, webSocket: new FakeSocket() };
      }),
    );
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(
      (s.store.get('health') as { wolfxEew: { receiving: boolean } }).wolfxEew
        .receiving,
    ).toBe(true);
    const second = stub();
    const restarted = s.make();
    await vi.advanceTimersByTimeAsync(0);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await restarted.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(
      second.posts.filter((p) => p.includes('受信できていません')),
    ).toHaveLength(2);
  });

  it('期間外の ensure で通知基準を初期状態に戻す', async () => {
    const s = setup({ DISCORD_QUAKE_WEBHOOK_URL: HOOK });
    const { posts } = stub();
    const relay = s.make();
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(3 * 60_000 + 1000);
    await relay.ensure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(posts.length).toBeGreaterThan(0);
    vi.setSystemTime(Date.parse('2026-11-22T00:00:00+09:00'));
    await relay.ensure();
    const health = s.store.get('health') as Record<
      string,
      { receiving: boolean }
    >;
    expect(Object.values(health).map((h) => h.receiving)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('受信の保存を待たず、受信の処理を順序どおり進める', async () => {
    const s = setup({ QUAKE_WOLFX_EEW_URL: 'wss://sandbox.example/jma_eew' });
    const { sockets } = stub();
    const put = s.storage.put;
    s.storage.put = (k: string, v: unknown) =>
      k === 'health' ? new Promise<void>(() => {}) : put(k, v);
    const relay = s.make();
    await relay.ensure();
    sockets.wolfxEew.emit('message', {
      data: fixture('hand-wolfx-eew-gunma-warning.json'),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect((await relay.status()).alert).toMatchObject({ active: true });
  });
});
