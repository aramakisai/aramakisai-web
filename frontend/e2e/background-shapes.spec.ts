import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';
import { PHASE_OVERRIDE_COOKIE } from '../src/lib/phase';

// Depends on CMS collections: announcements, topics, student_exhibitions, performance_slots, stages, map_areas

const VIEWPORTS = [
  { name: 'PC', width: 1440, height: 900 },
  { name: 'SP', width: 390, height: 844 },
] as const;

// playwright.config.ts の baseURL 解決と同じ既定値
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * /topics・/exhibitions は開催前フェーズで非公開 (festival-phase-gate)。
 * 開発者向けオーバーライド Cookie (要件 5.5: アクセス制御されたプレビュー環境でも有効) を
 * 使い、開催中フェーズとして開けるようにする
 */
async function applyLivePhaseOverride(context: BrowserContext) {
  await context.addCookies([
    { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: BASE_URL },
  ]);
}

/** 装飾レイヤーが描画され、図形が 1 個以上あることを確かめる */
async function expectShapesRendered(page: Page) {
  await expect(page.locator('[data-bg-shapes-body]')).toBeAttached();
  await expect(page.locator('[data-bg-shape]').first()).toBeAttached();
}

/** 一覧ページの最初の詳細リンクの href を取得する。ゲートで 404 か、未登録で 0 件なら null */
async function firstDetailHref(
  page: Page,
  listPath: string,
  linkPrefix: string,
): Promise<string | null> {
  const response = await page.goto(listPath);
  if (response?.status() === 404) return null;
  const link = page.locator(`main a[href^="${linkPrefix}"]`).first();
  if ((await link.count()) === 0) return null;
  return link.getAttribute('href');
}

async function checkCmsCollections(collections: readonly string[]) {
  const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';
  for (const collection of collections) {
    const checkResult = await checkCmsReachable(baseUrl, collection);
    if (checkResult.status === 'cms-dependency-error') {
      throw new Error(
        `CMS dependency error (${collection}): ${checkResult.detail}`,
      );
    }
  }
}

test.describe('背景図形: 主要ページで描画される', () => {
  test.beforeAll(async () => {
    await checkCmsCollections([
      'announcements',
      'topics',
      'student_exhibitions',
      'performance_slots',
      'stages',
      'map_areas',
    ]);
  });

  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
      });

      test('トップページ', async ({ page }) => {
        await page.goto('/');
        await expectShapesRendered(page);
      });

      test('お知らせ一覧', async ({ page }) => {
        await page.goto('/announcements');
        await expectShapesRendered(page);
      });

      test('お知らせ詳細', async ({ page }) => {
        const href = await firstDetailHref(
          page,
          '/announcements',
          '/announcements/',
        );
        if (!href) {
          test.skip(true, 'お知らせが未登録のため検証できません');
        }
        await page.goto(href!);
        await expectShapesRendered(page);
      });

      test('トピック一覧', async ({ page, context }) => {
        await applyLivePhaseOverride(context);
        const response = await page.goto('/topics');
        if (response?.status() === 404) {
          test.skip(
            true,
            'このビルドではフェーズオーバーライドが無効なため /topics を検証できません (festival-phase-gate)',
          );
        }
        await expectShapesRendered(page);
      });

      test('トピック詳細', async ({ page, context }) => {
        await applyLivePhaseOverride(context);
        const href = await firstDetailHref(page, '/topics', '/topics/');
        if (!href) {
          test.skip(
            true,
            'トピックスが未登録、またはこのビルドでは検証できません',
          );
        }
        await page.goto(href!);
        await expectShapesRendered(page);
      });

      test('企画一覧', async ({ page, context }) => {
        await applyLivePhaseOverride(context);
        const response = await page.goto('/exhibitions');
        if (response?.status() === 404) {
          test.skip(
            true,
            'このビルドではフェーズオーバーライドが無効なため /exhibitions を検証できません (festival-phase-gate)',
          );
        }
        await expectShapesRendered(page);
      });

      test('企画詳細', async ({ page, context }) => {
        await applyLivePhaseOverride(context);
        const href = await firstDetailHref(
          page,
          '/exhibitions',
          '/exhibitions/',
        );
        if (!href) {
          test.skip(true, '企画が未登録、またはこのビルドでは検証できません');
        }
        await page.goto(href!);
        await expectShapesRendered(page);
      });
    });
  }
});

/** 背景図形の外側要素 (design.md ShapeView 節) の left/top をそのまま位置の識別子として使う */
async function captureShapePositions(
  page: Page,
): Promise<{ left: string; top: string }[]> {
  return page.locator('[data-bg-shape]').evaluateAll((els) =>
    els.map((el) => ({
      left: (el as HTMLElement).style.left,
      top: (el as HTMLElement).style.top,
    })),
  );
}

test.describe('背景図形: 企画一覧の検索前後で図形位置が変わらない', () => {
  test.beforeAll(async () => {
    await checkCmsCollections([
      'student_exhibitions',
      'performance_slots',
      'stages',
      'map_areas',
    ]);
  });

  test('検索語入力前後で表示中の図形の位置が変わらない', async ({
    page,
    context,
  }) => {
    await applyLivePhaseOverride(context);
    const response = await page.goto('/exhibitions');
    if (response?.status() === 404) {
      test.skip(
        true,
        'このビルドではフェーズオーバーライドが無効なため /exhibitions を検証できません (festival-phase-gate)',
      );
    }
    await expectShapesRendered(page);

    const positionsBefore = await captureShapePositions(page);
    expect(positionsBefore.length).toBeGreaterThan(0);

    const searchBox = page.getByRole('searchbox', { name: '企画を検索' });
    await searchBox.fill('展示');
    await expect(page).toHaveURL(/[?&]q=%E5%B1%95%E7%A4%BA/, {
      timeout: 5000,
    });

    // 間引き (design.md「保持した配置の間引き」) は ResizeObserver 経由の非同期処理なので、
    // 残っている図形の位置が入力前の集合の部分集合に収まるまでポーリングで待つ
    await expect(async () => {
      const positionsAfter = await captureShapePositions(page);
      for (const position of positionsAfter) {
        expect(positionsBefore).toContainEqual(position);
      }
    }).toPass({ timeout: 5000 });
  });
});
