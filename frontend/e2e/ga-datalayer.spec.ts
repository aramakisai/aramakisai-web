import { expect, test, type Page } from '@playwright/test';
import { PHASE_OVERRIDE_COOKIE } from '../src/lib/phase';

// Depends on CMS collections: student_exhibitions, map_areas

type GaCommand = readonly unknown[];

/** dataLayer は Arguments 形式で積まれるため配列に直して読む */
async function readDataLayer(page: Page): Promise<GaCommand[]> {
  return page.evaluate(() =>
    (
      (window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ??
      []
    ).map((entry) => Array.from(entry)),
  );
}

const isPageView = (c: GaCommand) => c[0] === 'event' && c[1] === 'page_view';

async function pageViewCount(page: Page): Promise<number> {
  return (await readDataLayer(page)).filter(isPageView).length;
}

/** 描画とアイドル処理が落ち着くのを待ってから件数を読むための待機 */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1000);
}

test.describe('GA4 の dataLayer', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    // 検証は dataLayer の中身だけで行い、GA4 へは何も送らない
    await page.route('**/gtag/js**', (route) => route.abort());
    await page.route('**/g/collect**', (route) => route.abort());
    // 開催前フェーズでは /map・/exhibitions が非公開のため、開催中に切り替える
    await context.addCookies([
      { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
    ]);
  });

  test('初期化の js / set / config がどの独自イベントよりも先に積まれる', async ({
    page,
  }) => {
    await page.goto('/map');
    await expect.poll(() => pageViewCount(page)).toBe(1);
    await settle(page);

    const layer = await readDataLayer(page);
    expect(layer.slice(0, 3).map((c) => c[0])).toEqual(['js', 'set', 'config']);
    const firstEvent = layer.findIndex((c) => c[0] === 'event');
    expect(firstEvent).toBeGreaterThanOrEqual(3);
    expect(layer.slice(firstEvent).some((c) => c[0] === 'config')).toBe(false);
  });

  test('構内マップのエリア選択では page_view が増えない', async ({ page }) => {
    await page.goto('/map');
    await expect.poll(() => pageViewCount(page)).toBe(1);

    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 15000 });

    const polygon = page.locator('svg path[role="button"]').first();
    test.skip(
      (await polygon.count()) === 0,
      '有効な図形を持つエリアが登録されていないため検証できません',
    );
    // エリア名ラベルが図形の中心に重なり実クリックを遮るため、イベントを直接送る
    await polygon.dispatchEvent('click');
    await expect(page).toHaveURL(/[?&]area=\d+\b/);
    await settle(page);

    expect(await pageViewCount(page)).toBe(1);
  });

  test('企画一覧の絞り込みでは増えず、ページ送りでは増える', async ({
    page,
  }) => {
    await page.goto('/exhibitions');
    await expect.poll(() => pageViewCount(page)).toBe(1);

    await page.getByLabel('企画を検索').fill('a');
    await settle(page);
    expect(await pageViewCount(page)).toBe(1);

    await page.getByLabel('企画を検索').fill('');
    await settle(page);

    const next = page
      .getByRole('navigation', { name: 'ページ送り' })
      .locator('a:not([aria-label])')
      .filter({ hasText: /^2$/ });
    test.skip(
      (await next.count()) === 0,
      '企画が1ページに収まるためページ送りを検証できません',
    );
    const before = await pageViewCount(page);
    await next.click();
    await expect(page).toHaveURL(/[?&]page=2\b/);
    await expect.poll(() => pageViewCount(page)).toBe(before + 1);
  });

  test('2ページ目で絞り込んでも page_view が増えない', async ({ page }) => {
    await page.goto('/exhibitions?page=2');
    await expect.poll(() => pageViewCount(page)).toBe(1);

    await page.getByLabel('企画を検索').fill('a');
    await settle(page);
    expect(await pageViewCount(page)).toBe(1);
  });

  test('別ページへの遷移では page_view が増える', async ({ page }) => {
    await page.goto('/exhibitions');
    await expect.poll(() => pageViewCount(page)).toBe(1);

    const card = page.locator('main a[href^="/exhibitions/"]').first();
    test.skip((await card.count()) === 0, '企画が未登録のため検証できません');
    await card.click();
    await expect(page).toHaveURL(/\/exhibitions\/[^/?#]+/);
    await expect.poll(() => pageViewCount(page)).toBe(2);
  });

  test('マイページのタブ切替では page_view が増えない', async ({ page }) => {
    // タブはスマートフォン幅 (1024px 未満) でしか表示されない
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mypage');
    await expect.poll(() => pageViewCount(page)).toBe(1);

    await page.getByRole('tab', { name: 'ブックマーク' }).click();
    await expect(
      page.getByRole('tab', { name: 'ブックマーク', selected: true }),
    ).toBeVisible();
    await settle(page);

    expect(await pageViewCount(page)).toBe(1);
  });

  test('サイネージでは dataLayer に何も積まれない', async ({ page }) => {
    await page.goto('/signage');
    await settle(page);

    expect(await readDataLayer(page)).toEqual([]);
  });
});
