import { expect, test } from '@playwright/test';
import { checkDirectusReachable } from '../scripts/directus-check';

// Depends on Directus collections: topics, announcements

test.describe('一覧→個別記事→404遷移', () => {
  test.beforeAll(async () => {
    const baseUrl =
      process.env.NEXT_PUBLIC_DIRECTUS_URL || 'http://localhost:8055';

    for (const collection of ['topics', 'announcements']) {
      const checkResult = await checkDirectusReachable(baseUrl, collection);
      if (checkResult.status === 'directus-dependency-error') {
        throw new Error(
          `Directus dependency error (${collection}): ${checkResult.detail}`,
        );
      }
    }
  });

  test('トピックス一覧から個別記事へ遷移できる', async ({ page }) => {
    await page.goto('/topics');

    const firstLink = page.locator('main a[href^="/topics/"]').first();
    if ((await firstLink.count()) === 0) {
      test.skip(
        true,
        'トピックスが未登録のため一覧→個別記事遷移を検証できません',
      );
    }

    const href = await firstLink.getAttribute('href');
    await firstLink.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('main h1')).not.toBeEmpty();
  });

  test('お知らせ一覧(テーブル)から個別記事へ遷移できる', async ({ page }) => {
    await page.goto('/announcements');

    const firstLink = page.locator('table a[href^="/announcements/"]').first();
    if ((await firstLink.count()) === 0) {
      test.skip(
        true,
        'お知らせが未登録のため一覧→個別記事遷移を検証できません',
      );
    }

    const href = await firstLink.getAttribute('href');
    await firstLink.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('main h1')).not.toBeEmpty();
  });

  test('存在しないトピックスIDアクセス時に404が表示される', async ({
    page,
  }) => {
    const response = await page.goto('/topics/999999999');
    expect(response?.status()).toBe(404);
  });

  test('存在しないお知らせIDアクセス時に404が表示される', async ({ page }) => {
    const response = await page.goto('/announcements/999999999');
    expect(response?.status()).toBe(404);
  });
});
