import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: map_areas, student_exhibitions, performance_slots, stages, topics, announcements

const EXISTING_LIST_PAGES = [
  '/',
  '/exhibitions',
  '/announcements',
  '/topics',
] as const;

/** 地図の動的読み込みが終わるまで待つ (読み込み中は role="status" のプレースホルダーが出る) */
async function waitForMapReady(page: Page): Promise<void> {
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 15000 });
}

/** 選択可能なエリアポリゴン (SVG path)。キーボード選択のため role="button" を持つ */
function polygons(page: Page) {
  return page.locator('svg path[role="button"]');
}

test.describe('構内マップと既存ページの通し確認', () => {
  test.beforeAll(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';

    for (const collection of [
      'map_areas',
      'student_exhibitions',
      'performance_slots',
      'stages',
      'topics',
      'announcements',
    ]) {
      const checkResult = await checkCmsReachable(baseUrl, collection);
      if (checkResult.status === 'cms-dependency-error') {
        throw new Error(
          `CMS dependency error (${collection}): ${checkResult.detail}`,
        );
      }
    }
  });

  test('構内マップにはサイト共通ヘッダーとフッターが表示されない', async ({
    page,
  }) => {
    await page.goto('/map');
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
  });

  for (const path of EXISTING_LIST_PAGES) {
    test(`${path} は route group 移動後も URL を維持しヘッダーとフッターを表示する`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    });
  }

  test('企画詳細・お知らせ詳細・トピックス詳細ページも route group 移動後にヘッダーとフッターを表示する', async ({
    page,
  }) => {
    const detailSources = [
      { list: '/exhibitions', linkPrefix: '/exhibitions/' },
      { list: '/announcements', linkPrefix: '/announcements/' },
      { list: '/topics', linkPrefix: '/topics/' },
    ] as const;

    for (const { list, linkPrefix } of detailSources) {
      await page.goto(list);
      const link = page.locator(`a[href^="${linkPrefix}"]`).first();
      if ((await link.count()) === 0) continue;

      const href = await link.getAttribute('href');
      await page.goto(href!);
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    }
  });

  test('存在しないURLはシェル付きの404を表示する', async ({ page }) => {
    // (site) ルートグループの [slug] にマッチさせ、シェル付きの not-found を表示させる
    const response = await page.goto('/e2e-nonexistent-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404');
  });

  test('地図上に出典表記が表示され、ライセンス情報ページへのリンクを持つ', async ({
    page,
  }) => {
    await page.goto('/map');
    const attribution = page.locator('.leaflet-control-attribution');
    await expect(attribution).toContainText('OpenStreetMap');
    await expect(
      attribution.getByRole('link', { name: 'OpenStreetMap' }),
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  });

  test('ポリゴンを選ぶとURLとリストが切り替わり、再読み込みは発生しない。再度選ぶと未選択の案内に戻る', async ({
    page,
  }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため選択操作を検証できません',
      );
    }
    const polygon = polygons(page).first();
    const areaName = await polygon.getAttribute('aria-label');

    await expect(
      page.locator('p:visible', { hasText: '地図上のブロックをタップすると' }),
    ).toBeVisible();

    // ドキュメントが再読み込みされると window に立てた印は失われる。
    // pushState 経由の URL 更新であり Server Component の再取得を伴わないことの確認に使う
    await page.evaluate(() => {
      (
        window as unknown as { __e2eNoReloadMarker?: boolean }
      ).__e2eNoReloadMarker = true;
    });

    await polygon.click();

    await expect(page).toHaveURL(/[?&]area=\d+\b/);
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      areaName ?? '',
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __e2eNoReloadMarker?: boolean })
            .__e2eNoReloadMarker,
      ),
    ).toBe(true);

    await polygon.click();

    await expect(page).not.toHaveURL(/[?&]area=\d+\b/);
    await expect(
      page.locator('p:visible', { hasText: '地図上のブロックをタップすると' }),
    ).toBeVisible();
  });

  test('エリアを選択した後の戻る操作で選択前の状態に戻る', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため選択操作を検証できません',
      );
    }

    await polygons(page).first().click();
    await expect(page).toHaveURL(/[?&]area=\d+\b/);

    await page.goBack();

    await expect(page).not.toHaveURL(/[?&]area=\d+\b/);
    await expect(
      page.locator('p:visible', { hasText: '地図上のブロックをタップすると' }),
    ).toBeVisible();
  });

  test('出展物タイルから企画詳細ページへ遷移できる', async ({ page }) => {
    await page.goto('/map');
    await waitForMapReady(page);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため検証できません',
      );
    }

    const card = page.locator('a[href^="/exhibitions/"]:visible').first();
    let found = false;
    for (let i = 0; i < areaCount; i++) {
      await polygons(page).nth(i).click();
      if ((await card.count()) > 0) {
        found = true;
        break;
      }
      // このエリアに出展物がなかったので選択解除して次のエリアを試す
      await polygons(page).nth(i).click();
    }
    if (!found) {
      test.skip(
        true,
        '出展物が紐づくエリアが登録されていないため検証できません',
      );
    }

    const href = await card.getAttribute('href');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('地図タイルの読み込みが失敗しても、ポリゴンの選択とリストの表示が継続する', async ({
    page,
  }) => {
    // タイル資産はまだ生成されていない環境もあるため、意図的に 404 させて条件を固定する
    await page.route('**/map-tiles/**', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );

    await page.goto('/map');
    await waitForMapReady(page);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため検証できません',
      );
    }
    const polygon = polygons(page).first();
    const areaName = await polygon.getAttribute('aria-label');

    await polygon.click();

    await expect(page).toHaveURL(/[?&]area=\d+\b/);
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      areaName ?? '',
    );
  });
});
