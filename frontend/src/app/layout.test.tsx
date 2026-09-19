import { describe, expect, it, vi } from 'vitest';
import { generateMetadata } from './layout';

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

describe('RootLayout', () => {
  it('generateMetadata は NEXT_PUBLIC_SITE_URL を metadataBase に設定する', async () => {
    const metadata = await generateMetadata();

    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'));
  });
});
