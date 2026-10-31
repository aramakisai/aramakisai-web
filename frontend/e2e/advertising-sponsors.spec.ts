import { createServer, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';

const CMS_ORIGIN = 'http://127.0.0.1:18055';
const APP_ORIGIN = 'http://127.0.0.1:3011';
// 異なる縦横比を画像領域に収められることを確認する合成ロゴ。
const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="navy"/></svg>',
);
const TALL_LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><rect width="100" height="400" fill="navy"/></svg>',
);

const sponsors = [
  ...(['planA', 'planB', 'planC'] as const).flatMap((tier, groupIndex) =>
    Array.from({ length: groupIndex + 2 }, (_, index) => ({
      id: 100 + groupIndex * 10 + index,
      name: `架空${tier}-${index + 1}`,
      type: ['ad'],
      tier,
      logo: 100 + groupIndex * 10 + index,
      url: index === 0 ? 'https://example.invalid/sponsor' : null,
      _order: `0${index}`,
    })).reverse(),
  ),
  ...[
    { id: 201, name: '架空Dリンク', url: 'https://example.invalid/d' },
    {
      id: 202,
      name: '架空D企業名がとても長くても省略せず折り返して表示されます',
      url: null,
    },
    { id: 203, name: '架空D無効URL', url: 'javascript:alert(1)' },
  ]
    .map((item, index) => ({
      ...item,
      type: ['ad'],
      tier: 'planD',
      logo: null,
      _order: `0${index}`,
    }))
    .reverse(),
  {
    id: 300,
    name: '地域のみ企業',
    type: ['local'],
    tier: null,
    logo: null,
    url: null,
    _order: '00',
  },
];
const personal = [
  {
    id: 3,
    name: '架空の長い個人協賛者名が省略されず折り返して表示されます',
    _order: '03',
  },
  { id: 2, name: '架空二郎様', _order: '02' },
  { id: 1, name: '架空一郎', _order: '01' },
];

let cmsServer: Server | undefined;
let cmsMode: 'ok' | 'empty' | 'error' = 'ok';

async function startCmsFixture(): Promise<void> {
  if (
    process.env.E2E_LOCAL_APP !== '1' ||
    process.env.NEXT_PUBLIC_CMS_URL !== CMS_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL !== APP_ORIGIN ||
    process.env.E2E_BASE_URL !== APP_ORIGIN
  ) {
    throw new Error(
      '広告協賛 fixture は専用の loopback 環境でのみ実行できます',
    );
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', CMS_ORIGIN);
    if (url.pathname.startsWith('/api/media/serve/')) {
      response.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Access-Control-Allow-Origin': '*',
      });
      response.end(
        url.pathname.startsWith('/api/media/serve/110/') ? TALL_LOGO : LOGO,
      );
      return;
    }
    if (
      url.pathname === '/api/sponsors' ||
      url.pathname === '/api/personal_sponsors'
    ) {
      if (cmsMode === 'error') {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'fixture unavailable' }));
        return;
      }
      const input = url.pathname.endsWith('/sponsors') ? sponsors : personal;
      const docs =
        cmsMode === 'empty'
          ? []
          : [...input].sort((a, b) => a._order.localeCompare(b._order));
      if (url.searchParams.get('sort') !== '_order') {
        response.writeHead(400);
        response.end('fixture requires sort=_order');
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ docs, totalDocs: docs.length }));
      return;
    }
    // 他のグローバルや一覧は失敗にし、既存のフォールバックを利用する。
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end('{}');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // listen の EADDRINUSE をそのまま失敗扱いにし、既存プロセスには触れない。
    server.listen(18055, '127.0.0.1', resolve);
  });
  cmsServer = server;
}

async function openPage(
  page: Page,
  width: number,
  error = false,
): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      return route.continue();
    return route.abort();
  });
  await page.goto('/sponsors/ad', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', {
      name: error ? 'エラーが発生しました' : '広告協賛',
      exact: true,
    }),
  ).toBeVisible();
}

test.describe('広告協賛 fixture E2E', { tag: '@local-fixture' }, () => {
  test.skip(
    process.env.E2E_LOCAL_APP !== '1',
    '専用のローカル fixture 環境でのみ実行',
  );
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);
  test.beforeAll(startCmsFixture);
  test.afterAll(async () => {
    if (cmsServer) {
      await new Promise<void>((resolve, reject) => {
        cmsServer!.close((error) => (error ? reject(error) : resolve()));
        cmsServer!.closeAllConnections();
      });
    }
  });
  test.beforeEach(() => {
    cmsMode = 'ok';
  });

  for (const width of [1440, 1024, 1023, 390, 320]) {
    test(`${width}px の表示順・列・カード・折返し`, async ({ page }) => {
      await openPage(page, width);
      const expected = width >= 1024 ? [2, 3, 4, 3, 3] : [1, 2, 2, 2, 2];
      let previousBottom = 0;
      for (const [index, tier] of [
        'planA',
        'planB',
        'planC',
        'planD',
      ].entries()) {
        const list = page.locator(`ul[data-tier="${tier}"]`);
        const listBox = await list.boundingBox();
        expect(listBox!.y).toBeGreaterThanOrEqual(previousBottom);
        previousBottom = listBox!.y + listBox!.height;
        const columns = await list.evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(' ').length,
        );
        expect(columns).toBe(expected[index]);
        const items = list.locator(':scope > li');
        expect(await items.count()).toBe([2, 3, 4, 3][index]);
        if (tier === 'planD') {
          await expect(items).toHaveText([
            '架空Dリンク新しいタブで開きます',
            '架空D企業名がとても長くても省略せず折り返して表示されます',
            '架空D無効URL',
          ]);
        }
        if (index < 3) {
          for (let i = 0; i < (await items.count()); i++) {
            const item = items.nth(i);
            const box = await item.boundingBox();
            expect(box!.width / box!.height).toBeCloseTo(
              index === 0 ? 7 / 3 : 2,
              1,
            );
            const image = item.locator('img');
            const ratio =
              width >= 1024
                ? [460 / 548, 300 / 357, 220 / 268][index]
                : [300 / 358, 145 / 173, 135 / 173][index];
            const logoBox = await image.boundingBox();
            expect(Math.abs(logoBox!.width - box!.width * ratio)).toBeLessThan(
              0.1,
            );
            await expect(image).toHaveAttribute('alt', `架空${tier}-${i + 1}`);
            await expect
              .poll(() =>
                image.evaluate(
                  (img: HTMLImageElement, tall: boolean) =>
                    img.complete &&
                    img.naturalWidth === (tall ? 100 : 400) &&
                    img.naturalHeight === (tall ? 400 : 100),
                  tier === 'planB' && i === 0,
                ),
              )
              .toBe(true);
            expect(
              await image.evaluate((img) => getComputedStyle(img).objectFit),
            ).toBe('contain');
          }
        }
      }
      const personalList = page.locator(
        'ul[aria-labelledby="personal-sponsors-heading"]',
      );
      expect(
        await personalList.evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
        ),
      ).toBe(expected[4]);
      await expect(personalList.locator('li')).toHaveText([
        '架空一郎様',
        '架空二郎様',
        '架空の長い個人協賛者名が省略されず折り返して表示されます様',
      ]);
      await expect(page.getByText('地域のみ企業')).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      for (const item of [
        page.getByText(
          '架空D企業名がとても長くても省略せず折り返して表示されます',
        ),
        page.getByText(
          '架空の長い個人協賛者名が省略されず折り返して表示されます様',
        ),
      ]) {
        expect(
          await item.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        if (width <= 390)
          expect(
            await item.evaluate(
              (el) =>
                el.getBoundingClientRect().height >
                parseFloat(getComputedStyle(el).lineHeight),
            ),
          ).toBe(true);
      }
    });
  }

  test('リンクの有無、hover、キーボード、視覚的通知', async ({ page }) => {
    await openPage(page, 1440);
    const linked = page.locator('ul[data-tier="planA"] > li').first();
    const plain = page.locator('ul[data-tier="planA"] > li').nth(1);
    const link = linked.getByRole('link');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toContainText('新しいタブで開きます');
    const notification = link.getByText('新しいタブで開きます');
    await expect(notification).toHaveCount(1);
    expect(
      await notification.evaluate((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          style.position === 'absolute' &&
          rect.width <= 1 &&
          rect.height <= 1 &&
          style.overflow === 'hidden'
        );
      }),
    ).toBe(true);
    await expect(plain.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '架空D無効URL' })).toHaveCount(
      0,
    );
    const border = (el: Element) => getComputedStyle(el).borderColor;
    expect(await linked.evaluate(border)).toBe('rgb(230, 230, 230)');
    await linked.hover();
    await expect.poll(() => linked.evaluate(border)).toBe('rgb(211, 211, 211)');
    await plain.hover();
    expect(await plain.evaluate(border)).toBe('rgb(230, 230, 230)');
    for (
      let i = 0;
      i < 30 && !(await link.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((el) =>
        parseFloat(getComputedStyle(el).outlineWidth),
      ),
    ).toBeGreaterThan(0);
    const dLink = page.getByRole('link', { name: /架空Dリンク/ });
    await expect(dLink).toHaveAttribute('target', '_blank');
    await expect(dLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('本文スキップ、動きを減らす設定、canonical とサイトマップ', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, 1440);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: '本文へ移動' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(
      page.getByRole('button', { name: 'モーション' }),
    ).toBeVisible();
    const link = page.locator('ul[data-tier="planA"] > li').first();
    expect(
      await link.evaluate((el) => getComputedStyle(el).transitionProperty),
    ).toBe('none');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${APP_ORIGIN}/sponsors/ad`,
    );
    const sitemap = await page.request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain(`${APP_ORIGIN}/sponsors/ad`);
  });

  for (const phase of ['pre_event', 'live']) {
    test(`${phase} の導線`, async ({ page, context }) => {
      await context.addCookies([
        { name: 'aramakisai_phase_override', value: phase, url: APP_ORIGIN },
      ]);
      await openPage(page, 1440);
      // 開発サーバーの初回コンパイル後の再読込を待ち、hydration 後にメニューを操作する。
      await page.waitForLoadState('networkidle');
      await expect(
        page
          .getByRole('navigation', { name: 'フッターサイト案内' })
          .getByRole('link', { name: '広告協賛' }),
      ).toHaveAttribute('href', '/sponsors/ad');
      const group = phase === 'live' ? 'お知らせ' : '協賛';
      const nav = page.getByRole('navigation', {
        name: 'メインナビゲーション',
      });
      await nav.getByRole('button', { name: group }).focus();
      await expect(nav.getByRole('link', { name: '広告協賛' })).toHaveAttribute(
        'href',
        '/sponsors/ad',
      );
      await expect(nav.getByRole('link', { name: '広告協賛' })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      const menu = page.getByRole('button', { name: 'メニューを開く' });
      await menu.click();
      const mobile = page.getByRole('navigation', {
        name: 'モバイルナビゲーション',
      });
      await mobile.getByRole('button', { name: group }).click();
      await expect(
        mobile.getByRole('link', { name: '広告協賛' }),
      ).toHaveAttribute('href', '/sponsors/ad');
      await expect(
        mobile.getByRole('link', { name: '広告協賛' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'メニューを開く' }),
      ).toBeFocused();
    });
  }

  for (const mode of ['empty', 'error'] as const) {
    test(`CMS が ${mode} の場合に架空データを補完しない`, async ({ page }) => {
      cmsMode = mode;
      await openPage(page, 390, mode === 'error');
      await expect(page.locator('ul[data-tier]')).toHaveCount(0);
      await expect(
        page.locator('ul[aria-labelledby="personal-sponsors-heading"]'),
      ).toHaveCount(0);
      if (mode === 'empty')
        await expect(
          page.getByRole('heading', { name: '個人協賛者様' }),
        ).toBeVisible();
    });
  }
});
