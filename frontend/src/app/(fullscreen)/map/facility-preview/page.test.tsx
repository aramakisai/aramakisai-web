import { afterEach, describe, expect, it, vi } from 'vitest';

const renderCampusMapPage = vi.fn();
vi.mock('../map-page-content', () => ({
  renderCampusMapPage: (...args: unknown[]) => renderCampusMapPage(...args),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import Page, { generateMetadata } from './page';

afterEach(() => {
  vi.unstubAllEnvs();
  renderCampusMapPage.mockReset();
});

describe('施設プレビューページ', () => {
  it('本番ではデータ取得前に404とする', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NOT_FOUND',
    );
    expect(() => generateMetadata()).toThrow('NOT_FOUND');
    expect(renderCampusMapPage).not.toHaveBeenCalled();
  });

  it('開発環境で確定11地点とプレビューURLを共通画面に渡す', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    renderCampusMapPage.mockResolvedValue(null);
    await Page({ searchParams: Promise.resolve({}) });
    const args = renderCampusMapPage.mock.calls[0][0];
    expect(args.previewPoints).toHaveLength(11);
    expect(args.previewPoints[0]).toMatchObject({
      kind: 'reception',
      latitude: 36.431256,
      longitude: 139.044215,
    });
    expect(args.previewPoints[10]).toMatchObject({
      label: 'ママタルトお笑いライブ専用受付',
      latitude: 36.4302,
      longitude: 139.0447,
    });
    expect(args.basePath).toBe('/map/facility-preview');
  });

  it('テストデータは明示した場合だけ利用する', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    renderCampusMapPage.mockResolvedValue(null);
    await Page({ searchParams: Promise.resolve({ testData: '1' }) });
    const args = renderCampusMapPage.mock.calls[0][0];
    expect(args.testPamphletUrl).toBe('/map/facility-preview/test-pamphlet');
    expect(args.previewPoints[10].posterUrl).toMatch(/^data:image\/svg\+xml,/);
    expect(args.previewPoints[10].testData).toBe(true);
  });
});
