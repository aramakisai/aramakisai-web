import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: student_exhibitions, performance_slots, stages, map_areas

/** ページ送り UI に表示されている最終ページ番号。ページネーションが無ければ 1 件のみ。 */
async function getPageCount(page: Page): Promise<number> {
  const nav = page.getByRole('navigation', { name: 'ページ送り' });
  if ((await nav.count()) === 0) return 1;
  // 前後移動リンクは aria-label を持つため、それ以外 (ページ番号リンク) だけを見る
  const numberLinks = nav.locator('a:not([aria-label])');
  if ((await numberLinks.count()) === 0) return 1;
  return Number(await numberLinks.last().innerText()) || 1;
}

interface ExhibitionCardInfo {
  readonly href: string;
  /** そのカードのカテゴリ別企画内容の企画名 (企画一覧ページの h4) */
  readonly displayName: string;
  readonly hasPhoto: boolean;
}

/** 全ページを巡回し、企画カード (= 選択カテゴリ 1 件につき 1 枚) を企画 ID ごとに集める */
async function collectCardsById(
  page: Page,
): Promise<Map<string, ExhibitionCardInfo[]>> {
  await page.goto('/exhibitions');
  const pageCount = await getPageCount(page);

  const cardsById = new Map<string, ExhibitionCardInfo[]>();
  for (let p = 1; p <= pageCount; p++) {
    if (p > 1) await page.goto(`/exhibitions?page=${p}`);
    const cards = await page
      .locator('main a[href^="/exhibitions/"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          href: el.getAttribute('href') ?? '',
          displayName: el.querySelector('h4')?.textContent ?? '',
          hasPhoto: el.querySelector('[data-testid="icon-image"]') === null,
        })),
      );
    for (const card of cards) {
      const match = card.href.match(/^\/exhibitions\/(\d+)\/[a-z]+$/);
      if (!match) continue;
      const id = match[1]!;
      const list = cardsById.get(id) ?? [];
      list.push(card);
      cardsById.set(id, list);
    }
  }
  return cardsById;
}

/** 複数カテゴリを選択している (= 複数カードに分割された) 企画を 1 件探す */
async function findMultiEntryCards(
  page: Page,
): Promise<ExhibitionCardInfo[] | null> {
  const cardsById = await collectCardsById(page);
  return (
    Array.from(cardsById.values()).find((cards) => cards.length >= 2) ?? null
  );
}

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
        throw new Error(
          `CMS dependency error (${collection}): ${checkResult.detail}`,
        );
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

    const stageChip = page
      .getByRole('group', { name: 'カテゴリで絞り込み' })
      .getByRole('button', { name: 'ステージ' });
    await stageChip.click();
    await expect(page).toHaveURL(/[?&]category=stage/);

    const urlAfterFilter = page.url();
    const bodyAfterFilter = await page.locator('main').innerText();

    await page.goto(urlAfterFilter);
    await expect(
      page.getByRole('searchbox', { name: '企画を検索' }),
    ).toHaveValue('展示');
    await expect(
      page
        .getByRole('group', { name: 'カテゴリで絞り込み' })
        .getByRole('button', { name: 'ステージ' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(async () => {
      expect(await page.locator('main').innerText()).toBe(bodyAfterFilter);
    }).toPass({ timeout: 5000 });
  });

  test('存在しないIDの詳細ページは見つからないを返す', async ({ page }) => {
    const response = await page.goto('/exhibitions/999999999');
    expect(response?.status()).toBe(404);
  });

  test('複数のカテゴリを選択している企画は一覧で複数枚のカードとして表示される', async ({
    page,
  }) => {
    const cards = await findMultiEntryCards(page);
    if (!cards) {
      test.skip(
        true,
        '複数カテゴリを選択している企画が未登録のためカード分割を検証できません',
      );
    }

    // 選択カテゴリ 1 件につき 1 枚のカードなので、同一企画内でカテゴリが重複するカードはない
    // (categories は複数選択の select のため、同じ値を二重に選択できない)
    const categories = new Set(cards!.map((card) => card.href.split('/')[3]));
    expect(categories.size).toBe(cards!.length);
  });

  test('カードを選ぶと、そのカードのカテゴリに対応する詳細ページへ遷移し、そのカテゴリの企画名・紹介文・写真が表示される', async ({
    page,
  }) => {
    const cards = await findMultiEntryCards(page);
    if (!cards) {
      test.skip(
        true,
        '複数カテゴリを選択している企画が未登録のためカード別の遷移を検証できません',
      );
    }

    for (const card of cards!.slice(0, 2)) {
      await page.goto('/exhibitions');
      await page.locator(`main a[href="${card.href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${card.href}$`));

      // 詳細ページの企画名は、遷移元カードのカテゴリ別企画内容の企画名と一致する
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        card.displayName,
      );

      if (card.hasPhoto) {
        await expect(
          page.locator('main').getByRole('img').first(),
        ).toBeVisible();
        await expect(page.getByTestId('icon-hide-image')).toHaveCount(0);
      } else {
        await expect(page.getByTestId('icon-hide-image')).toBeVisible();
      }

      // 紹介文はカテゴリ別企画内容の任意項目のため、見出しがある場合のみ本文が表示されることを確認する
      const introHeading = page.getByRole('heading', { name: '紹介' });
      if ((await introHeading.count()) > 0) {
        await expect(
          introHeading.locator('xpath=following-sibling::p[1]'),
        ).not.toBeEmpty();
      }
    }
  });
});
