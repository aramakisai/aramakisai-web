import { describe, expect, it, vi } from 'vitest';

import { judgeImage, MODELS, type JudgeDeps } from './parking-judge';
import { createParkingJudgeRate } from './parking-judge-rate';

const ok = (o: object) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }), {
    status: 200,
  });
const status = (code: number) => new Response('{}', { status: code });
const GOOD = { congestion: 'crowded', image_quality: 'ok' };

function setup(responses: (Response | Error)[], over: Partial<JudgeDeps> = {}) {
  const queue = [...responses];
  const calls: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const deps: JudgeDeps = {
    apiKey: 'KEY',
    rate: createParkingJudgeRate(),
    fetchImpl: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      const next = queue.shift();
      if (!next) throw new Error('unexpected call');
      if (next instanceof Error) throw next;
      return next;
    }) as unknown as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
    isCurrent: async () => true,
    ...over,
  };
  return { deps, calls, sleeps };
}
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0]);
const modelOf = (url: string) => /models\/([^:]+):/.exec(url)![1];

describe('judgeImage', () => {
  it('成功で最初のモデルの結果を返し、キーをヘッダーで渡す', async () => {
    const { deps, calls } = setup([ok(GOOD)]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r).toEqual({ kind: 'judged', model: MODELS[0], congestion: 'crowded', quality: 'ok' });
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('KEY');
    expect(calls[0].url).not.toContain('KEY');
  });

  it('500 を 2 回のあと成功し、2 秒・4 秒待つ', async () => {
    const { deps, sleeps, calls } = setup([status(500), status(503), ok(GOOD)]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r.kind).toBe('judged');
    expect(sleeps).toEqual([2000, 4000]);
    expect(calls.map((c) => modelOf(c.url))).toEqual([MODELS[0], MODELS[0], MODELS[0]]);
  });

  it('26B が 3 回 500 で 31B に切り替わる', async () => {
    const { deps, calls } = setup([status(500), status(500), status(500), ok(GOOD)]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r).toMatchObject({ kind: 'judged', model: MODELS[1] });
    expect(calls.map((c) => modelOf(c.url))).toEqual([MODELS[0], MODELS[0], MODELS[0], MODELS[1]]);
  });

  it('429 は待たずに次へ進み、そのモデルを休ませる', async () => {
    const { deps, sleeps } = setup([status(429), ok(GOOD)]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r).toMatchObject({ kind: 'judged', model: MODELS[1] });
    expect(sleeps).toEqual([]);
    expect(deps.rate.tryAcquire(MODELS[0], new Date())).toBe(false);
  });

  it('その他の 4xx も呼び直さず次へ', async () => {
    const { deps, calls } = setup([status(400), ok(GOOD)]);
    await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(calls).toHaveLength(2);
  });

  it('全モデル失敗で失敗と応答コードの要約を返す', async () => {
    const { deps } = setup([
      ...Array(3).fill(status(500)),
      ...Array(3).fill(status(500)),
      ...Array(3).fill(status(503)),
    ]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r).toEqual({
      kind: 'failed',
      detail: 'gemma-4-26b-a4b-it 500x3, gemma-4-31b-it 500x3, gemini-3.1-flash-lite 503x3',
    });
  });

  it('打ち切り・通信失敗・形の不正も呼び直しの対象', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const { deps } = setup([timeout, new Error('net'), new Response('not json'), ok(GOOD)]);
    expect(await judgeImage(jpeg, 'congestion_and_quality', deps)).toMatchObject({ kind: 'judged', model: MODELS[1] });
  });

  it('unknown はモデルを切り替えずに返す', async () => {
    const { deps, calls } = setup([ok({ congestion: 'unknown', image_quality: 'ok' })]);
    const r = await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(r).toMatchObject({ kind: 'judged', congestion: 'unknown' });
    expect(calls).toHaveLength(1);
  });

  it('image_quality だけ不正なら写り具合を値なしで返す', async () => {
    const { deps } = setup([ok({ congestion: 'full', image_quality: 'purple' })]);
    expect(await judgeImage(jpeg, 'congestion_and_quality', deps)).toMatchObject({
      kind: 'judged',
      congestion: 'full',
      quality: null,
    });
  });

  it('congestion が不正なら呼び直す', async () => {
    const { deps, calls } = setup([ok({ congestion: 'x', image_quality: 'ok' }), ok(GOOD)]);
    await judgeImage(jpeg, 'congestion_and_quality', deps);
    expect(calls).toHaveLength(2);
  });

  it('写り具合だけの判定は congestion を持たないスキーマで呼ぶ', async () => {
    const { deps, calls } = setup([ok({ image_quality: 'too_dark' })]);
    const r = await judgeImage(jpeg, 'quality_only', deps);
    expect(r).toEqual({ kind: 'judged', model: MODELS[0], congestion: null, quality: 'too_dark' });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.generationConfig.responseSchema.required).toEqual(['image_quality']);
    expect(body.systemInstruction.parts[0].text).toMatch(/^You judge an image from a fixed camera\.\n/);
  });

  it('写り具合だけの判定で image_quality が不正なら呼び直す', async () => {
    const { deps, calls } = setup([ok({ image_quality: 'x' }), ok({ image_quality: 'ok' })]);
    await judgeImage(jpeg, 'quality_only', deps);
    expect(calls).toHaveLength(2);
  });

  it('最新でなくなったら呼び直さず打ち切る', async () => {
    const { deps, calls } = setup([status(500), ok(GOOD)], { isCurrent: async () => false });
    expect(await judgeImage(jpeg, 'congestion_and_quality', deps)).toEqual({ kind: 'superseded' });
    expect(calls).toHaveLength(1);
  });

  it('一度も呼び出せなければ見送り', async () => {
    const { deps, calls } = setup([]);
    for (const m of MODELS) deps.rate.coolDown(m, new Date(Date.now() + 60_000));
    expect(await judgeImage(jpeg, 'congestion_and_quality', deps)).toEqual({ kind: 'rate_limited' });
    expect(calls).toHaveLength(0);
  });
});
