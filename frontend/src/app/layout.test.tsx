import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateMetadata } from './layout';
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
