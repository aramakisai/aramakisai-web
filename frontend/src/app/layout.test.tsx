import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout, { generateMetadata } from './layout';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/site-metadata', () => ({
  getSiteMetadata: vi.fn(async () => ({
    siteTitle: '荒牧祭',
    description: '荒牧祭公式サイト',
    ogImageUrl: null,
    festival: null,
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

const cookiesMock = vi.fn();
vi.mock('next/headers', () => ({ cookies: cookiesMock }));

describe('RootLayout', () => {
  it('generateMetadata は NEXT_PUBLIC_SITE_URL を metadataBase に設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'));
  });

  it('generateMetadata はサイト既定値から openGraph / twitter / robots / description を出力する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.description).toBe('荒牧祭公式サイト');
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      siteName: '荒牧祭',
      locale: 'ja_JP',
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.alternates).toBeUndefined();
  });
});

describe('RootLayout - Material Symbols', () => {
  it('現在地ボタン用の my_location を読み込み対象に含む', () => {
    const html = renderToStaticMarkup(RootLayout({ children: <div /> }));

    expect(html).toMatch(/icon_names=[^"&]*\bmy_location\b/);
  });
});

describe('RootLayout - モーション抑制の初期反映 (要件 21.7, 21.8)', () => {
  it('hydration 前に停止指定を判定するスクリプトを <head> に埋め込む', async () => {
    const ui = RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(html).toContain('aramakisai_motion');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain("setAttribute('data-motion', 'reduce')");
  });

  it('OS 設定が reduce で保存値が no-preference のとき、hydration 前スクリプトの実行だけで data-motion=reduce が付く (要件 21.4)', async () => {
    const ui = RootLayout({ children: <div>content</div> });
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
    cookiesMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('開発用フラグが有効なとき、Cookie から解決したフェーズで切替UIを描画する', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');
    const { default: RootLayout } = await import('./layout');
    const ui = RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(cookiesMock).not.toHaveBeenCalled();
    expect(html).toContain('開催前');
    expect(html).toContain('定数');
  });

  it('開発用フラグが無効なとき、Cookie を読まず切替UIを描画しない', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE', '');

    const { default: RootLayout } = await import('./layout');
    const ui = RootLayout({ children: <div>content</div> });
    const html = renderToStaticMarkup(ui);

    expect(cookiesMock).not.toHaveBeenCalled();
    expect(html).not.toContain('開催前');
    expect(html).not.toContain('開催中');
  });
});

vi.mock('@/components/google-analytics', () => ({
  GoogleAnalytics: () => <i data-testid="ga" />,
}));

describe('RootLayout - GA4', () => {
  it('旧 gtag スクリプトを持たず GoogleAnalytics を置く', () => {
    const html = renderToStaticMarkup(RootLayout({ children: <div /> }));
    expect(html).not.toContain('googletagmanager');
    expect(html).not.toContain('gtag-init');
    expect(html).toContain('data-testid="ga"');
  });
});
