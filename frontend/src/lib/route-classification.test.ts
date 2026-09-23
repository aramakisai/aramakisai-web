import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { listAppRoutes } from '@/lib/app-routes';
import {
  PRE_EVENT_PUBLIC_PATHS,
  PRE_EVENT_PUBLIC_PREFIXES,
  isPublicPath,
} from '@/lib/phase';
import { navigationItemsByPhase, linkableChildren } from '@/lib/navigation';

const appDir = join(process.cwd(), 'src/app');

type Route = ReturnType<typeof listAppRoutes>[number];

function routePattern(route: Route): string {
  return route.length === 0 ? '/' : `/${route.map((s) => s.value).join('/')}`;
}

// slug で解決される固定ページ (pages コレクション) のルート。ルートパターン自体は
// PRE_EVENT_PUBLIC_PATHS に載らないが、/access・/privacy という公開値をこのルートが
// 解決するため、完全一致・ルート単位のどちらにも収まらない第三の分類を要する。
const PARTIALLY_PUBLIC_ROUTES: readonly string[] = ['/[slug]'];

// 新しいページを追加した際、公開対象一覧にも下のいずれにも登録しなければ
// classifyRoute が undefined を返しテストが失敗する。
const INTENTIONALLY_PRIVATE_ROUTES: readonly string[] = [
  '/topics',
  '/topics/[id]',
  '/exhibitions',
  '/exhibitions/[id]/[category]',
  '/map',
  '/gated',
  '/gated-fullscreen',
];

type Classification =
  'exact_public' | 'route_public' | 'partial_public' | 'intentional_private';

function classifyRoute(route: Route): Classification | undefined {
  const pattern = routePattern(route);
  const hasDynamicSegment = route.some((segment) => segment.dynamic);

  if (!hasDynamicSegment && PRE_EVENT_PUBLIC_PATHS.includes(pattern)) {
    return 'exact_public';
  }
  const lastSegment = route[route.length - 1];
  if (
    hasDynamicSegment &&
    lastSegment.dynamic &&
    PRE_EVENT_PUBLIC_PREFIXES.some(
      (prefix) => `${prefix}${lastSegment.value}` === pattern,
    )
  ) {
    return 'route_public';
  }
  if (PARTIALLY_PUBLIC_ROUTES.includes(pattern)) {
    return 'partial_public';
  }
  if (INTENTIONALLY_PRIVATE_ROUTES.includes(pattern)) {
    return 'intentional_private';
  }
  return undefined;
}

describe('ルートと公開対象一覧の整合', () => {
  test('全ルートが宣言済みの分類のいずれかに属する', () => {
    const routes = listAppRoutes(appDir);
    const unclassified = routes
      .map(routePattern)
      .filter((_, index) => classifyRoute(routes[index]) === undefined);

    expect(unclassified).toEqual([]);
  });

  test('/[slug] ルートは値単位で一部が公開されるパターンとして宣言されている', () => {
    const routes = listAppRoutes(appDir);
    const slugRoute = routes.find((route) => routePattern(route) === '/[slug]');

    expect(slugRoute).toBeDefined();
    expect(classifyRoute(slugRoute!)).toBe('partial_public');
  });

  test('ゲートの書き換え先ルートは意図的な非公開として宣言されている', () => {
    const routes = listAppRoutes(appDir);
    const gatedRoute = routes.find((route) => routePattern(route) === '/gated');

    expect(gatedRoute).toBeDefined();
    expect(classifyRoute(gatedRoute!)).toBe('intentional_private');
  });

  test('(fullscreen) 向けのゲート書き換え先ルートも意図的な非公開として宣言されている', () => {
    const routes = listAppRoutes(appDir);
    const gatedFullscreenRoute = routes.find(
      (route) => routePattern(route) === '/gated-fullscreen',
    );

    expect(gatedFullscreenRoute).toBeDefined();
    expect(classifyRoute(gatedFullscreenRoute!)).toBe('intentional_private');
  });

  test('ナビ項目を描画する全コンポーネントのリンク先が開催前フェーズの公開対象に含まれる', () => {
    // フッターのサイト案内・ご案内はヘッダーと同じ定義から導出するため、
    // この一覧でフッターの導線も網羅する。
    const hrefs = navigationItemsByPhase.pre_event.flatMap((item) => [
      ...(item.href ? [item.href] : []),
      ...linkableChildren(item).map((child) => child.href),
    ]);

    for (const href of hrefs) {
      const [path] = href.split('#');
      expect(isPublicPath(path, 'pre_event')).toBe(true);
    }
  });
});
