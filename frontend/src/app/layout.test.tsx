import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout, { generateMetadata } from './layout';
import { PHASE_OVERRIDE_COOKIE } from '@/lib/phase';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('next/font/google', () => ({
  Zen_Old_Mincho: () => ({ variable: 'font-zen-old-mincho' }),
}));

vi.mock('@/lib/festival-meta', () => ({
  getFestivalMeta: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

const cookiesGetMock = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookiesGetMock })),
}));

describe('RootLayout', () => {
  it('generateMetadata は NEXT_PUBLIC_SITE_URL を metadataBase に設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'));
  });
});

describe('RootLayout - モーション抑制の初期反映 (要件 21.7, 21.8)', () => {
  it('hydration 前に停止指定を判定するスクリプトを <head> に埋め込む', async () => {
    cookiesGetMock.mockReturnValue(undefined);

    const ui = await RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(html).toContain('aramakisai_motion');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain("setAttribute('data-motion', 'reduce')");
  });

  it('OS 設定が reduce で保存値が no-preference のとき、hydration 前スクリプトの実行だけで data-motion=reduce が付く (要件 21.4)', async () => {
    cookiesGetMock.mockReturnValue(undefined);

    const ui = await RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const scriptBody = scriptMatch![1];

    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('no-preference'),
    });
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    document.documentElement.removeAttribute('data-motion');

    try {
      new Function(scriptBody)();
      expect(document.documentElement.getAttribute('data-motion')).toBe(
        'reduce',
      );
    } finally {
      document.documentElement.removeAttribute('data-motion');
      vi.unstubAllGlobals();
    }
  });
});

describe('RootLayout - 切替UIの結線', () => {
  beforeEach(() => {
    vi.resetModules();
    cookiesGetMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('開発用フラグが有効なとき、Cookie から解決したフェーズで切替UIを描画する', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    cookiesGetMock.mockReturnValue(undefined);

    const { default: RootLayout } = await import('./layout');
    const ui = await RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(cookiesGetMock).toHaveBeenCalledWith(PHASE_OVERRIDE_COOKIE);
    expect(html).toContain('開催前');
    expect(html).toContain('定数');
  });

  it('開発用フラグが無効なとき、Cookie を読まず切替UIを描画しない', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');

    const { default: RootLayout } = await import('./layout');
    const ui = await RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(cookiesGetMock).not.toHaveBeenCalled();
    expect(html).not.toContain('開催前');
    expect(html).not.toContain('開催中');
  });
});
