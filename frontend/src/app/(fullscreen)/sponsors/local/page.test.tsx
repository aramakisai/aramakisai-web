import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SiteMetadata } from '@/lib/site-metadata';
import { generateMetadata, revalidate } from './page';
import * as siteMetadataModule from '@/lib/site-metadata';

vi.mock('@/lib/regional-sponsors', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/regional-sponsors')>();
  return { ...actual, getRegionalSponsorMapData: vi.fn() };
});

vi.mock('@/lib/site-metadata', () => ({ getSiteMetadata: vi.fn() }));
vi.mock('@/lib/request-phase', () => ({
  getRequestPhase: vi.fn(async () => ({
    phase: 'pre_event',
    source: 'constant',
  })),
}));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

const props: Record<string, unknown>[] = [];
vi.mock(
  '@/components/regional-sponsor-map/regional-sponsor-map-screen',
  () => ({
    RegionalSponsorMapScreen: (value: Record<string, unknown>) => {
      props.push(value);
      return <div data-testid="regional-sponsor-map-screen" />;
    },
  }),
);

const SITE_METADATA: SiteMetadata = {
  siteTitle: '荒牧祭',
  description: '荒牧祭公式サイト',
  ogImageUrl: null,
  festival: null,
};

beforeEach(() => {
  props.length = 0;
  vi.mocked(siteMetadataModule.getSiteMetadata).mockResolvedValue(
    SITE_METADATA,
  );
});

describe('RegionalSponsorMapPage', () => {
  it('既存方針と同じ60秒更新を使う', () => {
    expect(revalidate).toBe(60);
  });
});

describe('generateMetadata', () => {
  it('地域協賛mapのtitle・description・canonicalを設定する', async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe('地域協賛マップ');
    expect(metadata.description).toMatch(/地域/);
    expect(metadata.alternates).toEqual({ canonical: '/sponsors/local' });
  });
});
