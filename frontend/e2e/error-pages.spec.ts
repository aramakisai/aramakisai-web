import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: topics

/**
 * error.tsx/global-error.tsx は Client Component で <meta name="robots"> を
 * JSX に直書きするため、root layout が generateMetadata 経由で出す
 * index,follow の <meta name="robots"> と共存し2つ出力される (design.md
 * research.md の決定事項)。出現順はSSR直後とハイドレーション後で入れ替わるため、
 * 先頭要素ではなく全要素のいずれかに noindex が含まれることを見る。
 */
async function expectSomeRobotsMetaNoindex(page: Page): Promise<void> {
  const contents = await page
    .locator('meta[name="robots"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('content')));
  expect(contents.some((content) => content?.includes('noindex'))).toBe(true);
}

/**
 * 開催前フェーズでは middleware (src/middleware.ts) がホワイトリスト外のパスを
 * 全て /gated へ rewrite し、本 spec が狙う個別の404/エラー画面 (ルート404・
 * e2e-error-trigger 系) に到達できなくなる。isPublicPath は phase==='live' のとき
 * 無条件で真を返すため、Cookie でフェーズを 'live' に上書きしてゲートを無効化する。
 * DEV_OVERRIDE_ENABLED (src/lib/phase.ts) が偽の本番ビルドではこの Cookie は
 * 無視されるため、この手段は本番では効かない。
 */
const PHASE_OVERRIDE_COOKIE = 'aramakisai_phase_override';

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

function errorPageResults(layer: GaCommand[]): string[] {
  return layer
    .filter((c) => c[0] === 'event' && c[1] === 'error_page')
    .map((c) => (c[2] as { result: string }).result);
}

test.describe('エラー表示画面', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    // 検証は dataLayer の中身だけで行い、GA4 へは何も送らない
    await page.route('**/gtag/js**', (route) => route.abort());
    await page.route('**/g/collect**', (route) => route.abort());
    await context.addCookies([
      { name: PHASE_OVERRIDE_COOKIE, value: 'live', url: baseURL },
    ]);
  });

  test('存在しないURL (複数セグメント) はルート直下のnot-found.tsxが固有タイトルで表示される', async ({
    page,
  }) => {
    const response = await page.goto('/no-such-route/definitely-not-real');

    expect(response?.status()).toBe(404);
    await expect(page.getByText('404')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'ページが見つかりません' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/ページが見つかりません/);
    await expectSomeRobotsMetaNoindex(page);
    // ルート layout のみを経由するため、Site 共通のヘッダー・フッターは持たない
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    // streaming metadata が無効化されず root layout の非同期 generateMetadata が
    // 後からマウントされると、この待機の間にタイトルが既定値へ巻き戻る
    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/ページが見つかりません/);
    await expectSomeRobotsMetaNoindex(page);
  });

  test('存在しない1セグメントのスラッグは(site)/not-found.tsxがヘッダー・フッター込みで固有タイトルで表示される', async ({
    page,
  }) => {
    const response = await page.goto('/no-such-static-page-xyz');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'ページが見つかりません' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/ページが見つかりません/);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/ページが見つかりません/);
  });

  test('詳細ページで存在しないIDにアクセスすると、Site not-found.tsx側の固有タイトルが優先される', async ({
    page,
  }) => {
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';
    const checkResult = await checkCmsReachable(baseUrl, 'topics');
    if (checkResult.status === 'cms-dependency-error') {
      throw new Error(`CMS dependency error (topics): ${checkResult.detail}`);
    }

    const response = await page.goto('/topics/999999999');

    expect(response?.status()).toBe(404);
    // トピックス詳細の generateMetadata が返すサイト既定タイトルではなく、
    // not-found.tsx 固有のタイトルが最終的にブラウザへ反映されることを確認する (要件 2.5)
    await expect(page).toHaveTitle(/ページが見つかりません/);
    await expectSomeRobotsMetaNoindex(page);

    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/ページが見つかりません/);
    await expectSomeRobotsMetaNoindex(page);
  });

  test('Site配下で意図的に例外を発生させるとエラー画面が表示され、再読み込みボタンが機能する', async ({
    page,
  }) => {
    await page.goto('/e2e-error-trigger');

    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/エラーが発生しました/);
    await expectSomeRobotsMetaNoindex(page);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/エラーが発生しました/);

    await page.getByRole('button', { name: '再読み込み' }).click();
    // トリガーページは常に再度例外を投げるため、retry() 実行後も同じエラー画面が
    // (白画面にならず) 再表示されることを確認する
    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeVisible();
  });

  test('Fullscreen配下で意図的に例外を発生させるとヘッダー・フッター無しのエラー画面が表示され、再読み込みボタンが機能する', async ({
    page,
  }) => {
    await page.goto('/e2e-error-trigger-fullscreen');

    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/エラーが発生しました/);
    await expectSomeRobotsMetaNoindex(page);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/エラーが発生しました/);

    await page.getByRole('button', { name: '再読み込み' }).click();
    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeVisible();
  });

  test('再試行が失敗し続けると retry_fail が1件だけ積まれ、エラー表示は重ならない', async ({
    page,
  }) => {
    await page.goto('/e2e-error-trigger');
    const heading = page.getByRole('heading', { name: 'エラーが発生しました' });
    await expect(heading).toBeVisible();

    await page.getByRole('button', { name: '再読み込み' }).click();

    await expect
      .poll(async () => errorPageResults(await readDataLayer(page)))
      .toEqual(['error', 'retry_fail']);
    await expect(heading).toHaveCount(1);
    // アンマウント後の遅延判定が走っても retry_success は積まれない
    await page.waitForTimeout(500);
    expect(errorPageResults(await readDataLayer(page))).toEqual([
      'error',
      'retry_fail',
    ]);
  });

  test('Cookie を付けてから再試行すると本来の本文に戻り、retry_success が1件だけ積まれる', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto('/e2e-error-trigger');
    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeVisible();

    await context.addCookies([
      { name: 'e2e_retry_ok', value: '1', url: baseURL },
    ]);
    await page.getByRole('button', { name: '再読み込み' }).click();

    await expect(page.getByText('回復しました')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toHaveCount(0);
    await expect
      .poll(async () => errorPageResults(await readDataLayer(page)))
      .toEqual(['error', 'retry_success']);
  });
});
