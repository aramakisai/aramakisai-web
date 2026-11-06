import { describe, expect, it, vi } from 'vitest';

const autoResponses: [string, string][] = [];
vi.stubGlobal(
  'WebSocketRequestResponsePair',
  class {
    constructor(
      readonly request: string,
      readonly response: string,
    ) {
      autoResponses.push([request, response]);
    }
  },
);

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));

const { SignageHub } = await import('./index');

function fakeCtx(alarm: number | null = null) {
  const store = new Map<string, unknown>();
  const ctx = {
    alarm,
    setWebSocketAutoResponse: () => {},
    blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
    getWebSockets: () => [{ send: vi.fn() }],
    storage: {
      get: async (k: string) => store.get(k),
      put: async (k: string, v: unknown) => void store.set(k, v),
      getAlarm: async () => ctx.alarm,
      setAlarm: async (at: number) => {
        ctx.alarm = at;
      },
    },
  };
  return ctx;
}

const pin = { slide: null, visibleSlideIds: [1] };

describe('SignageHub の ping/pong', () => {
  it('コンストラクタで ping に pong を自動応答させ、届いたメッセージは捨てる', () => {
    const ctx = { ...fakeCtx(), setWebSocketAutoResponse: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hub = new SignageHub(ctx as any, {} as any);
    expect(ctx.setWebSocketAutoResponse).toHaveBeenCalledTimes(1);
    expect(autoResponses.at(-1)).toEqual(['ping', 'pong']);
    const ws = { send: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (hub as any).webSocketMessage(ws, 'anything');
    expect(ws.send).not.toHaveBeenCalled();
  });
});

describe('SignageHub の alarm の扱い', () => {
  it('pin 取得中に届いた通知の早い alarm を、後ろへ上書きしない', async () => {
    const ctx = fakeCtx();
    const env = {
      SITE: {
        fetch: async () => {
          await hub.notify(['snapshot']);
          return Response.json(pin);
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hub = new SignageHub(ctx as any, env as any);
    await hub.alarm();
    const notified = ctx.alarm!;
    expect(notified - Date.now()).toBeLessThan(1_000);
  });

  it('alarm が無い保持ありの接続で保険の alarm を予約する', async () => {
    const ctx = fakeCtx();
    const env = { SITE: { fetch: async () => Response.json(pin) } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hub = new SignageHub(ctx as any, env as any);
    await hub.alarm();
    ctx.alarm = null;
    class P {
      0 = {};
      1 = { send: () => {} };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocketPair = P;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).acceptWebSocket = () => {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx as any).getWebSockets = () => [];
    await hub
      .fetch(new Request('https://x/', { headers: { Upgrade: 'websocket' } }))
      .catch(() => {});
    expect(ctx.alarm).not.toBeNull();
  });
});

describe('SignageHub の接続元タグ', () => {
  const newHub = (ctx: object) =>
    new SignageHub(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { SITE: { fetch: async () => Response.json(pin) } } as any,
    );

  function setupHub(tagged: Record<string, number>, total: number) {
    const ctx = {
      ...fakeCtx(),
      getWebSockets: (tag?: string) =>
        tag === undefined
          ? Array.from({ length: total }, () => ({ send: vi.fn() }))
          : Array.from({ length: tagged[tag] ?? 0 }, () => ({ send: vi.fn() })),
    };
    return newHub(ctx);
  }

  it('接続元ごとの件数を数え、タグの無い接続は unknown に入れる', async () => {
    const hub = setupHub({ prod: 2, dev: 1, preview: 0, unknown: 1 }, 5);
    const stats = await hub.stats();
    expect(stats.connections).toEqual({
      prod: 2,
      dev: 1,
      preview: 0,
      unknown: 2,
    });
    expect(Number.isNaN(Date.parse(stats.at))).toBe(false);
  });

  it.each([
    ['prod', ['prod']],
    ['dev', ['dev']],
    ['preview', ['preview']],
    ['unknown', ['unknown']],
    ['evil', ['unknown']],
    [null, ['unknown']],
  ])('ヘッダ %s の接続は %j のタグで受け入れる', async (header, tags) => {
    const accepted: unknown[][] = [];
    const ctx = {
      ...fakeCtx(),
      acceptWebSocket: (...args: unknown[]) => void accepted.push(args),
      getWebSockets: () => [],
    };
    class P {
      0 = {};
      1 = { send: () => {} };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocketPair = P;
    const hub = newHub(ctx);
    const headers: Record<string, string> = { Upgrade: 'websocket' };
    if (header) headers['X-Signage-Origin'] = header;
    await hub.fetch(new Request('https://x/', { headers })).catch(() => {});
    expect(accepted[0][1]).toEqual(tags);
  });
});
