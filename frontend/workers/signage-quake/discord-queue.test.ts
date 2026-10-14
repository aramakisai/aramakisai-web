import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscordQueue, type DiscordQueueDeps } from './discord';
import type { EewKey, QuakeNotice } from './relay-core';
import { normalizeMessage, type EewReport } from './upstream';

const URL_ = 'https://discord.com/api/webhooks/123/secret-token';
const NOW = Date.parse('2026-10-23T01:00:00Z');

const dismissed = (n = 0): QuakeNotice => ({
  kind: 'dismissed',
  by: `u${n}@example.com`,
  training: false,
  at: NOW,
});
const report = normalizeMessage(
  'p2p',
  readFileSync(
    new URL('./fixtures/hand-p2p-556-gunma-warning.json', import.meta.url),
    'utf8',
  ),
  { test: false },
) as EewReport;
const eewNotice = (op: 'post' | 'edit'): QuakeNotice => ({
  kind: 'eew',
  op,
  report,
  receivedAt: NOW,
});
const KEY: EewKey = {
  eventId: report.eventId,
  serial: report.serial,
  cancelled: false,
};

const json = (status: number, body: unknown = {}, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

type Reply = Response | Error;
function setup(
  replies: Reply[],
  over: Partial<DiscordQueueDeps> = {},
  webhookUrl: string | null = URL_,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const saved: [EewKey, string][] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let clock = NOW;
  const fetchFn = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      const r = replies.shift() ?? json(200, { id: 'default' });
      if (r instanceof Error) throw r;
      return r;
    },
  );
  const deps: DiscordQueueDeps = {
    webhookUrl,
    fetch: fetchFn as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    messageIdFor: () => 'M0',
    saveMessageId: async (k, id) => {
      saved.push([k, id]);
    },
    ...over,
  };
  const q = new DiscordQueue(deps);
  return { q, calls, sleeps, saved, fetchFn, maxInFlight: () => maxInFlight };
}
const settle = (cond: () => boolean) =>
  vi.waitFor(() => expect(cond()).toBe(true));

afterEach(() => vi.restoreAllMocks());

describe('投稿と編集', () => {
  it('投稿は?wait=trueで送り、応答のメッセージIDを保存する', async () => {
    const t = setup([json(200, { id: 'M1' })]);
    t.q.enqueue(eewNotice('post'));
    await settle(() => t.saved.length === 1);
    expect(t.calls[0]!.url).toBe(`${URL_}?wait=true`);
    expect(t.calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(t.calls[0]!.init.body as string)).toMatchObject({
      allowed_mentions: { parse: [] },
    });
    expect(t.saved).toEqual([[KEY, 'M1']]);
    expect(t.q.status().lastSuccessAt).toBe(new Date(NOW).toISOString());
  });

  it('報でない通知はIDを保存しない', async () => {
    const t = setup([json(200, { id: 'M1' })]);
    t.q.enqueue(dismissed());
    await settle(() => t.q.status().lastSuccessAt !== null);
    expect(t.saved).toEqual([]);
  });

  it('編集は記録のメッセージIDへPATCHする', async () => {
    const t = setup([json(200, {})], { messageIdFor: () => 'M9' });
    t.q.enqueue(eewNotice('edit'));
    await settle(() => t.calls.length === 1);
    expect(t.calls[0]!.url).toBe(`${URL_}/messages/M9`);
    expect(t.calls[0]!.init.method).toBe('PATCH');
    expect(t.saved).toEqual([]);
  });

  it('編集でIDが無ければ投稿にしてIDを保存する', async () => {
    const t = setup([json(200, { id: 'M2' })], { messageIdFor: () => null });
    t.q.enqueue(eewNotice('edit'));
    await settle(() => t.saved.length === 1);
    expect(t.calls[0]!.init.method).toBe('POST');
    expect(t.saved[0]![1]).toBe('M2');
  });

  it('記録が進んでいれば編集を送らない', async () => {
    const t = setup([], { messageIdFor: () => undefined });
    t.q.enqueue(eewNotice('edit'));
    t.q.enqueue(dismissed());
    await settle(() => t.calls.length === 1);
    expect(t.calls[0]!.init.method).toBe('POST');
    expect(t.calls[0]!.url).toContain('wait=true');
  });

  it('編集の直前に記録を読む(先の投稿の保存を待てる)', async () => {
    let id: string | null = null;
    const t = setup([json(200, { id: 'M1' }), json(200, {})], {
      messageIdFor: () => id,
      saveMessageId: async (_k, m) => {
        id = m;
      },
    });
    t.q.enqueue(eewNotice('post'));
    t.q.enqueue(eewNotice('edit'));
    await settle(() => t.calls.length === 2);
    expect(t.calls[1]!.url).toBe(`${URL_}/messages/M1`);
  });

  it('保存に失敗しても次の通知を送る', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(200, { id: 'M1' })], {
      saveMessageId: async () => {
        throw new Error('x');
      },
    });
    t.q.enqueue(eewNotice('post'));
    t.q.enqueue(dismissed());
    await settle(() => t.calls.length === 2);
  });
});

describe('待ち行列', () => {
  it('1件ずつ順に送り、同時に送る要求は1つだけ', async () => {
    const t = setup([]);
    for (let i = 0; i < 5; i++) t.q.enqueue(dismissed(i));
    await settle(() => t.calls.length === 5);
    expect(t.maxInFlight()).toBe(1);
    expect(
      t.calls.map((c) => JSON.parse(c.init.body as string).content as string),
    ).toEqual([0, 1, 2, 3, 4].map((i) => expect.stringContaining(`u${i}@`)));
  });

  it('足す操作は送信を待たない', () => {
    const t = setup([]);
    const r = t.q.enqueue(dismissed());
    expect(r).toBeUndefined();
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
  });

  it('上限100件を超えたら新しい通知を捨てる', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([]);
    // 1件は送信中、100件が待ち、残りは捨てる
    for (let i = 0; i < 105; i++) t.q.enqueue(dismissed(i));
    await settle(() => t.calls.length === 101);
    await Promise.resolve();
    expect(t.calls).toHaveLength(101);
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it('Webhook未設定なら何も送らず、状態に出す', () => {
    const t = setup([], {}, null);
    t.q.enqueue(dismissed());
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(t.q.status().configured).toBe(false);
  });
});

describe('レート制限', () => {
  it('残りが0なら、次の要求の前にReset-After(秒)だけ待つ', async () => {
    const t = setup([
      json(
        200,
        { id: 'a' },
        { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '1.5' },
      ),
      json(200, { id: 'b' }),
    ]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([1500]);
  });

  it('残りがあれば待たない', async () => {
    const t = setup([
      json(
        200,
        {},
        { 'X-RateLimit-Remaining': '3', 'X-RateLimit-Reset-After': '9' },
      ),
    ]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([]);
  });

  it('429は本文のretry_after(秒、小数)だけ待って同じ要求を送り直す', async () => {
    const t = setup([json(429, { retry_after: 1.25 }), json(200, { id: 'M' })]);
    t.q.enqueue(eewNotice('post'));
    await settle(() => t.saved.length === 1);
    expect(t.sleeps).toEqual([1250]);
    expect(t.calls[1]!.url).toBe(t.calls[0]!.url);
    expect(t.calls[1]!.init.body).toBe(t.calls[0]!.init.body);
  });

  it('429で本文に無ければRetry-Afterヘッダに従う', async () => {
    const t = setup([json(429, {}, { 'Retry-After': '2' }), json(200)]);
    t.q.enqueue(dismissed());
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([2000]);
  });

  it('30秒を超える待ちは諦めて、次の通知に進む', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(429, { retry_after: 31 }), json(200)]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([]);
    expect(t.q.status().lastFailure).toBe('http_429');
    expect(t.q.status().disabled).toBe(false);
  });

  it('30秒ちょうどは待つ', async () => {
    const t = setup([json(429, { retry_after: 30 }), json(200)]);
    t.q.enqueue(dismissed());
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([30000]);
  });
});

describe('再試行と失敗', () => {
  it('5xxは2秒・5秒待って3回まで送り、失敗を状態に残す', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(503), json(500), json(502)]);
    t.q.enqueue(dismissed());
    await settle(() => t.q.status().lastFailure !== null);
    expect(t.calls).toHaveLength(3);
    expect(t.sleeps).toEqual([2000, 5000]);
    expect(t.q.status().lastFailure).toBe('http_502');
    expect(t.q.status().lastFailureAt).not.toBeNull();
  });

  it('5xxのあと成功すれば成功として扱う', async () => {
    const t = setup([json(500), json(200, { id: 'M' })]);
    t.q.enqueue(eewNotice('post'));
    await settle(() => t.saved.length === 1);
    expect(t.sleeps).toEqual([2000]);
    expect(t.q.status().lastFailure).toBeNull();
  });

  it('通信の失敗は3回まで', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([
      new TypeError('x'),
      new TypeError('x'),
      new TypeError('x'),
    ]);
    t.q.enqueue(dismissed());
    await settle(() => t.q.status().lastFailure !== null);
    expect(t.calls).toHaveLength(3);
    expect(t.q.status().lastFailure).toBe('network');
  });

  it('10秒のタイムアウトを要求に付け、3回までで諦める', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const timeout = () =>
      Object.assign(new Error('t'), { name: 'TimeoutError' });
    const t = setup([timeout(), timeout(), timeout()]);
    const spy = vi.spyOn(AbortSignal, 'timeout');
    t.q.enqueue(dismissed());
    await settle(() => t.q.status().lastFailure !== null);
    expect(spy).toHaveBeenCalledWith(10_000);
    expect(t.calls).toHaveLength(3);
    expect(t.q.status().lastFailure).toBe('timeout');
  });

  it('400は送り直さず捨てて、次の通知に進む', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(400), json(200)]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.calls.length === 2);
    expect(t.sleeps).toEqual([]);
    expect(t.q.status()).toMatchObject({
      lastFailure: 'http_400',
      disabled: false,
    });
  });

  it.each([401, 403, 404])('%dは再起動まで送信を止める', async (code) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(code)]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.q.status().disabled);
    t.q.enqueue(dismissed(3));
    await Promise.resolve();
    expect(t.calls).toHaveLength(1);
    expect(t.q.status().lastFailure).toBe(`http_${code}`);
  });

  it('失敗してもURL・本文を状態にもログにも出さない', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = setup([json(500), json(500), json(500), json(401)]);
    t.q.enqueue(dismissed(1));
    t.q.enqueue(dismissed(2));
    await settle(() => t.q.status().disabled);
    const all = JSON.stringify([t.q.status(), warn.mock.calls]);
    expect(all).not.toContain('secret-token');
    expect(all).not.toContain('example.com');
  });
});
