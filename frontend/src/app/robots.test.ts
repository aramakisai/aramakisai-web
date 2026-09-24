import { describe, expect, it, vi } from 'vitest';
import robots from './robots';
import { PRE_EVENT_PUBLIC_PATHS } from '@/lib/phase';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'https://aramakisai.com',
  },
}));

describe('robots', () => {
  it('sitemap を絶対 URL で宣言する', () => {
    const result = robots();
    expect(result.sitemap).toBe('https://aramakisai.com/sitemap.xml');
  });

  it('開催前フェーズでは公開パス一覧のみを許可し、ゲート先を禁止する', () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.disallow).toContain('/');
    expect(rule?.disallow).toContain('/gated');
    expect(rule?.disallow).toContain('/gated-fullscreen');
    for (const path of PRE_EVENT_PUBLIC_PATHS) {
      expect(rule?.allow).toContain(`${path}$`);
    }
  });

  it('開催中フェーズではサイト全体を許可する', async () => {
    vi.doMock('@/lib/phase', async () => {
      const actual =
        await vi.importActual<typeof import('@/lib/phase')>('@/lib/phase');
      return { ...actual, BUILD_PHASE: 'live' };
    });
    vi.resetModules();

    const { default: robotsWithLivePhase } = await import('./robots');
    const result = robotsWithLivePhase();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.allow).toEqual(['/']);
    expect(rule?.disallow).not.toContain('/');

    vi.doUnmock('@/lib/phase');
    vi.resetModules();
  });
});
