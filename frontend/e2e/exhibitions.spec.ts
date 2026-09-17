import { expect, test } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: student_exhibitions, performance_slots, stages, map_areas

test.describe('企画一覧→企画詳細', () => {
  test.beforeAll(async () => {
    const baseUrl = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:3000';

    for (const collection of [
      'student_exhibitions',
      'performance_slots',
      'stages',
      'map_areas',
    ]) {
      const checkResult = await checkCmsReachable(baseUrl, collection);
      if (checkResult.status === 'cms-dependency-error') {
        throw new Error(`CMS dependency error (${collection}): ${checkResult.detail}`);
      }
    }
  });

  test('一覧から企画カードを選ぶと詳細ページへ遷移する', async ({ page }) => {
    await page.goto('/exhibitions');

    const firstCard = page.locator('main a[href^="/exhibitions/"]').first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, '企画が未登録のため一覧→詳細遷移を検証できません');
    }

    const href = await firstCard.getAttribute('href');
    await firstCard.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('main h1')).not.toBeEmpty();
  });

  test('検索・カテゴリ絞り込みがURLに反映され、同じURLで同じ結果になる', async ({
    page,
  }) => {
    await page.goto('/exhibitions');

    const searchBox = page.getByRole('searchbox', { name: '企画を検索' });
    await searchBox.fill('展示');
    await expect(page).toHaveURL(/[?&]q=%E5%B1%95%E7%A4%BA/, { timeout: 5000 });

    const stageChip = page.getByRole('group', { name: 'カテゴリで絞り込み' }).getByRole('button', { name: 'ステージ' });
    await stageChip.click();
    await expect(page).toHaveURL(/[?&]category=stage/);

    const urlAfterFilter = page.url();
    const bodyAfterFilter = await page.locator('main').innerText();

    await page.goto(urlAfterFilter);
    await expect(page.getByRole('searchbox', { name: '企画を検索' })).toHaveValue('展示');
    await expect(
      page.getByRole('group', { name: 'カテゴリで絞り込み' }).getByRole('button', { name: 'ステージ' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(async () => {
      expect(await page.locator('main').innerText()).toBe(bodyAfterFilter);
    }).toPass({ timeout: 5000 });
  });

  test('存在しないIDの詳細ページは見つからないを返す', async ({ page }) => {
    const response = await page.goto('/exhibitions/999999999');
    expect(response?.status()).toBe(404);
  });
});
