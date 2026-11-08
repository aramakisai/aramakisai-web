import { expect, test } from '@playwright/test';

for (const [name, viewport] of [
  ['PC', { width: 1440, height: 900 }],
  ['スマートフォン', { width: 390, height: 844 }],
] as const) {
  test(`${name}: 受付の詳細と施設マーカーを表示する`, async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(
      !baseURL ||
        !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname),
      '施設プレビューはローカル開発環境専用',
    );
    await page.setViewportSize(viewport);
    const response = await page.goto('/map/facility-preview?testData=1');
    expect(response?.status()).toBe(200);
    const reception = page
      .locator('.leaflet-marker-icon')
      .filter({ hasText: /^受付$/ });
    const comedy = page
      .locator('.leaflet-marker-icon')
      .filter({ hasText: /^お笑いライブ受付$/ });
    await expect(reception).toHaveCount(2);
    await expect(comedy).toHaveCount(1);
    await expect(
      page.locator('.leaflet-garbage-points-pane .leaflet-marker-icon'),
    ).toHaveCount(8);
    await expect(page.locator('svg path[role="button"]')).toHaveCount(20);
    await page.screenshot({ path: testInfo.outputPath('map.png') });
    await reception.first().locator('span').click();
    await expect(
      page.locator('p:visible', {
        hasText: 'こちらの受付では、荒牧祭のパンフレットを配布しています。',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'デジタルパンフレットを見る' }),
    ).toHaveAttribute('href', '/map/facility-preview/test-pamphlet');
    await page
      .getByRole('link', { name: 'デジタルパンフレットを見る' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'プレビュー用テストパンフレット' }),
    ).toBeVisible();
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await comedy.locator('span').click();
    await expect(
      page.getByRole('heading', { name: 'ママタルトお笑いライブ受付' }),
    ).toBeVisible();
    await expect(
      page.locator('img:visible[alt="お笑いライブのポスター"]'),
    ).toBeVisible();
    await expect(
      page.locator('p:visible', { hasText: 'プレビュー用テストデータ' }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('comedy.png') });
  });
}
