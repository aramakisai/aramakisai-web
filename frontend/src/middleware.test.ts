import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PHASE_OVERRIDE_COOKIE, PRE_EVENT_PUBLIC_PATHS } from './lib/phase';

function makeRequest(path: string, cookieValue?: string): NextRequest {
  const request = new NextRequest(new URL(`https://example.com${path}`));
  if (cookieValue !== undefined) {
    request.cookies.set(PHASE_OVERRIDE_COOKIE, cookieValue);
  }
  return request;
}

describe('middleware (開発用フラグが偽のビルド)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(PRE_EVENT_PUBLIC_PATHS)(
    '公開対象一覧のパス %s はそのまま通す',
    async (path) => {
      const { middleware } = await import('./middleware');
      const response = middleware(makeRequest(path));
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    },
  );

  it('公開対象一覧に無いパスは gated ルートへ書き換える', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/topics'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/gated',
    );
  });

  it('(fullscreen) 配下の非公開パスはヘッダー・フッター無しの gated ルートへ書き換える', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/map'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/gated-fullscreen',
    );
  });

  it('書き換え先にクエリ文字列を引き継がない', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/topics?foo=bar'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/gated',
    );
  });

  it('オーバーライド Cookie を与えても無視して非公開パスを書き換える', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/topics', 'live'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/gated',
    );
  });
});

describe('middleware (開発用フラグが真のビルド)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('開催中へのオーバーライド Cookie があれば非公開パスも通す', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/topics', 'live'));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('オーバーライド Cookie が無ければ BUILD_PHASE (開催前) で判定する', async () => {
    const { middleware } = await import('./middleware');
    const response = middleware(makeRequest('/topics'));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://example.com/gated',
    );
  });
});
