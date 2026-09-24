import {
  BUILD_PHASE,
  PRE_EVENT_PUBLIC_PATHS,
  PRE_EVENT_PUBLIC_PREFIXES,
} from '@/lib/phase';
import type { FestivalPhase } from '@/lib/phase';

/** クローラは Cookie によるフェーズ上書きを持たないため常にビルド時点のフェーズで判定する。 */
export function crawlPhase(): FestivalPhase {
  return BUILD_PHASE;
}

export interface RobotsPlan {
  readonly allow: readonly string[];
  readonly disallow: readonly string[];
}

// middleware の rewrite 先。クロールされても実体が無いため常に対象外にする。
const GATED_REWRITE_TARGETS: readonly string[] = [
  '/gated',
  '/gated-fullscreen',
];

// generateMetadata を持たないビルド生成物や画像配信パス。開催前でも描画に要る。
const RENDER_ASSET_PREFIXES: readonly string[] = ['/_next/', '/images/'];

/** フェーズごとの robots allow/disallow を phase.ts の公開判定一覧から導出する。 */
export function buildRobotsPlan(phase: FestivalPhase): RobotsPlan {
  if (phase === 'live') {
    return { allow: ['/'], disallow: GATED_REWRITE_TARGETS };
  }

  return {
    allow: [
      ...PRE_EVENT_PUBLIC_PATHS.map((path) => `${path}$`),
      ...PRE_EVENT_PUBLIC_PREFIXES,
      ...RENDER_ASSET_PREFIXES,
    ],
    disallow: ['/', ...GATED_REWRITE_TARGETS],
  };
}

// 2 セグメント以上 (例: /sponsors/ad) はトップページ内アンカーで、対応する
// page.tsx を持たない。1 セグメントのものだけがルート実体 (固定ページ含む) を持つ。
function hasRouteEntity(path: string): boolean {
  return path.split('/').length <= 2;
}

/** /exhibitions /topics /map はフェーズによっては公開されないため PRE_EVENT_PUBLIC_PATHS に無い */
const LIVE_ONLY_CODE_ROUTES: readonly string[] = [
  '/exhibitions',
  '/topics',
  '/map',
];

/**
 * sitemap 候補のコード定義ルート。フェーズによる公開判定はここでは行わず、
 * 呼び出し側 (sitemap.ts) が isPublicPath で絞る。
 */
export const SITEMAP_CODE_ROUTES: readonly string[] = [
  ...PRE_EVENT_PUBLIC_PATHS.filter(hasRouteEntity),
  ...LIVE_ONLY_CODE_ROUTES,
];
