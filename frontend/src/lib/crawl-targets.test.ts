import { describe, expect, it } from 'vitest';
import {
  buildRobotsPlan,
  crawlPhase,
  SITEMAP_CODE_ROUTES,
} from './crawl-targets';
import {
  BUILD_PHASE,
  PRE_EVENT_PUBLIC_PATHS,
  PRE_EVENT_PUBLIC_PREFIXES,
} from './phase';

describe('crawlPhase', () => {
  it('BUILD_PHASE をそのまま返す', () => {
    expect(crawlPhase()).toBe(BUILD_PHASE);
  });
});

describe('buildRobotsPlan', () => {
  it('開催前は公開パス一覧のみを $ 終端で許可し、サイト全体を禁止する', () => {
    const plan = buildRobotsPlan('pre_event');

    expect(plan.disallow).toContain('/');
    for (const path of PRE_EVENT_PUBLIC_PATHS) {
      expect(plan.allow).toContain(`${path}$`);
    }
    for (const prefix of PRE_EVENT_PUBLIC_PREFIXES) {
      expect(plan.allow).toContain(prefix);
    }
  });

  it('開催前でも描画資産の配信パスを許可する', () => {
    const plan = buildRobotsPlan('pre_event');

    expect(plan.allow).toContain('/_next/');
    expect(plan.allow).toContain('/images/');
  });

  it('開催前・開催中のいずれもゲートの rewrite 先を禁止する', () => {
    for (const phase of ['pre_event', 'live'] as const) {
      const plan = buildRobotsPlan(phase);
      expect(plan.disallow).toContain('/gated');
      expect(plan.disallow).toContain('/gated-fullscreen');
    }
  });

  it('開催中はサイト全体を許可する', () => {
    const plan = buildRobotsPlan('live');

    expect(plan.allow).toEqual(['/']);
    expect(plan.disallow).not.toContain('/');
  });
});

describe('SITEMAP_CODE_ROUTES', () => {
  it('ルート実体を持たない /sponsors/* を含まない', () => {
    expect(SITEMAP_CODE_ROUTES).not.toContain('/sponsors/ad');
    expect(SITEMAP_CODE_ROUTES).not.toContain('/sponsors/local');
  });

  it('開催中のみ公開される一覧ルートを含む', () => {
    expect(SITEMAP_CODE_ROUTES).toEqual(
      expect.arrayContaining(['/exhibitions', '/topics', '/map']),
    );
  });

  it('1 セグメントの公開パス一覧をすべて含む', () => {
    for (const path of PRE_EVENT_PUBLIC_PATHS) {
      if (path.split('/').length <= 2) {
        expect(SITEMAP_CODE_ROUTES).toContain(path);
      }
    }
  });
});
