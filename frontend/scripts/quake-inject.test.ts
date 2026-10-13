import { describe, expect, it, vi } from 'vitest';
import { injectFiles, parseInjectArgs } from './quake-inject';

describe('parseInjectArgs', () => {
  it('url・系統・間隔・ファイルを受ける', () => {
    expect(
      parseInjectArgs([
        '--url',
        'http://localhost:5200/',
        '--channel',
        'wolfxEew',
        '--interval',
        '2',
        'a.json',
        'b.json',
      ]),
    ).toEqual({
      url: 'http://localhost:5200',
      channel: 'wolfxEew',
      interval: 2,
      files: ['a.json', 'b.json'],
    });
  });
  it('間隔の既定は1秒', () => {
    expect(
      parseInjectArgs(['--url', 'http://x', '--channel', 'p2p', 'a.json'])
        .interval,
    ).toBe(1);
  });
  it('未知の系統・ファイル無し・url無しはエラー', () => {
    expect(() =>
      parseInjectArgs(['--url', 'http://x', '--channel', 'foo', 'a.json']),
    ).toThrow(/channel/);
    expect(() =>
      parseInjectArgs(['--url', 'http://x', '--channel', 'p2p']),
    ).toThrow(/ファイル/);
    expect(() => parseInjectArgs(['--channel', 'p2p', 'a.json'])).toThrow(
      /url/,
    );
  });
});

describe('injectFiles', () => {
  const base = {
    url: 'http://relay',
    channel: 'wolfxEew' as const,
    interval: 2,
    files: ['a.json', 'b.json'],
  };

  it('ファイルの中身を順に、Bearer付きで投入口へ送り、間の秒だけ待つ', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push(`${String(url)} ${init?.method} ${init?.body}`);
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          'Bearer tok',
        );
        return new Response(null, { status: 204 });
      },
    );
    const sleep = vi.fn(async () => {});
    await injectFiles(base, {
      token: 'tok',
      fetch: fetchImpl as unknown as typeof fetch,
      sleep,
      read: (f) => `{"file":"${f}"}`,
    });
    expect(calls).toEqual([
      'http://relay/dev/inject/wolfxEew POST {"file":"a.json"}',
      'http://relay/dev/inject/wolfxEew POST {"file":"b.json"}',
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('トークン未設定・HTTPエラーは例外', async () => {
    const deps = {
      fetch: (async () => new Response(null, { status: 401 })) as typeof fetch,
      sleep: async () => {},
      read: () => '{}',
    };
    await expect(injectFiles(base, { ...deps, token: '' })).rejects.toThrow(
      /SIGNAGE_QUAKE_TOKEN/,
    );
    await expect(injectFiles(base, { ...deps, token: 't' })).rejects.toThrow(
      /401/,
    );
  });
});
