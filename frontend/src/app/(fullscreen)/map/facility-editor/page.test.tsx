import { afterEach, describe, expect, it, vi } from 'vitest';

const getCampusMapData = vi.fn();
vi.mock('@/lib/campus-map', () => ({
  getCampusMapData: (...args: unknown[]) => getCampusMapData(...args),
}));
vi.mock('@/components/campus-map/facility-editor-screen', () => ({
  FacilityEditorScreen: () => null,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import Page, { generateMetadata } from './page';

afterEach(() => {
  vi.unstubAllEnvs();
  getCampusMapData.mockReset();
});

describe('施設配置確認ページ', () => {
  it('本番環境ではデータ取得前に404とする', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(Page()).rejects.toThrow('NOT_FOUND');
    expect(() => generateMetadata()).toThrow('NOT_FOUND');
    expect(getCampusMapData).not.toHaveBeenCalled();
  });

  it('開発環境では既存の地図データを読み込む', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    getCampusMapData.mockResolvedValue({
      areas: { kind: 'loaded', value: [] },
      points: [],
    });
    await expect(Page()).resolves.toBeTruthy();
    expect(getCampusMapData).toHaveBeenCalledOnce();
  });
});
