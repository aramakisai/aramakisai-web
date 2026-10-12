import { describe, expect, it, vi } from 'vitest';

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
      .fetch(
        new Request('https://x/', { headers: { Upgrade: 'websocket' } }),
      )
      .catch(() => {});
    expect(ctx.alarm).not.toBeNull();
  });
});
