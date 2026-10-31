import { expect, test, type Page } from '@playwright/test';
import { REGIONAL_MAP_TILE_PROFILE } from '../src/lib/map-tile-profile';
import {
  ONE_PIXEL_PNG,
  setRegionalCmsMode,
} from './fixtures/cms-fixture-server';

async function useFixtureTiles(page: Page): Promise<void> {
  await page.route('**/regional-map-tiles/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: ONE_PIXEL_PNG,
    }),
  );
}

async function openMap(page: Page): Promise<void> {
  await page.goto('/sponsors/local', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.leaflet-container')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('地図を読み込んでいます…')).toHaveCount(0, {
    timeout: 20_000,
  });
}

async function expectMapControlsAboveSheet(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const sheet = document.querySelector<HTMLElement>(
          '[data-testid="map-bottom-sheet"]',
        );
        const attribution = document.querySelector<HTMLElement>(
          '.leaflet-control-attribution',
        );
        const zoom = document.querySelector<HTMLElement>(
          '.leaflet-control-zoom',
        );
        if (!sheet || !attribution || !zoom) return false;
        const sheetBox = sheet.getBoundingClientRect();
        const controls = [attribution, zoom].map((element) =>
          element.getBoundingClientRect(),
        );
        return (
          // 地図コンテナはシート上端から角丸の 16px だけシートの下に潜る
          controls.every(
            (box) =>
              box.width > 0 &&
              box.height > 0 &&
              box.top >= 0 &&
              box.bottom <= sheetBox.top + 16,
          )
        );
      }),
    )
    .toBe(true);
}

async function expectSelectedPinBetweenOverlays(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const visibleElement = <T extends HTMLElement>(selector: string) =>
          [...document.querySelectorAll<T>(selector)].find((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.height > 0;
          });
        const search = visibleElement<HTMLInputElement>('input[type="search"]');
        const sheet = document.querySelector<HTMLElement>(
          '[data-testid="map-bottom-sheet"]',
        );
        const pin = document.querySelector<HTMLElement>(
          '.leaflet-marker-icon[aria-current="true"]',
        );
        if (!search || !sheet || !pin) return false;
        const categoryGroup = visibleElement<HTMLElement>(
          '[role="group"][aria-label="カテゴリで絞り込む"]',
        );
        const searchBox = search.getBoundingClientRect();
        const categoryBox = categoryGroup?.getBoundingClientRect();
        const overlayBottom = Math.max(
          searchBox.bottom,
          categoryBox?.bottom ?? searchBox.bottom,
        );
        const sheetBox = sheet.getBoundingClientRect();
        const pinBox = pin.getBoundingClientRect();
        const target = document.elementFromPoint(
          pinBox.left + pinBox.width / 2,
          pinBox.top + pinBox.height / 2,
        );
        return (
          overlayBottom < sheetBox.top &&
          pinBox.top >= overlayBottom &&
          pinBox.bottom <= sheetBox.top &&
          (target === pin || (target instanceof Node && pin.contains(target)))
        );
      }),
    )
    .toBe(true);
}

// PC パネルと SP シートは両方描画され、使わない側は非表示になる。文言で引く要素は表示中のものに絞る
test.describe('地域協賛マップ fixture E2E', { tag: '@local-fixture' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await setRegionalCmsMode('ok');
    await useFixtureTiles(page);
  });

  test('CMS取得失敗を通知し、再試行で一覧を復元する', async ({ page }) => {
    await setRegionalCmsMode('error');
    await page.goto('/sponsors/local', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('alert').filter({
        hasText: '地域協賛情報を取得できませんでした。',
      }),
    ).toBeVisible();
    await setRegionalCmsMode('ok');
    await page.getByRole('button', { name: '再試行' }).click();
    await expect(page.getByText('8件').locator('visible=true')).toBeVisible();
  });

  test('PCで検索・カテゴリ・詳細の操作で見出しへフォーカスが移る', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    await page
      .getByPlaceholder('店舗名・カテゴリ・住所で検索')
      .locator('visible=true')
      .fill('中央1-1');
    await page.getByRole('button', { name: '病院', exact: true }).click();
    await page
      .getByRole('button', { name: /テスト専用あらまき病院.*詳細を表示/ })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
  });

  test('単独ピンのキーボード操作で詳細へ遷移する', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    await page
      .getByRole('button', {
        name: 'テスト専用あらまき病院、病院',
        exact: true,
      })
      .press('Enter');
    await expect(
      page.getByRole('heading', { name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
  });

  test('同一座標ピンから地点の一覧と詳細へ遷移する', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    await page
      .getByRole('button', {
        name: /2件の地域協賛：テスト専用食堂A（飲食）、テスト専用食堂B（飲食）。選択して一覧を表示/,
      })
      .click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeFocused();
    await page
      .getByRole('button', { name: /テスト専用食堂B.*詳細を表示/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'テスト専用食堂B' }),
    ).toBeFocused();
  });

  for (const [width, height] of [
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ] as const) {
    test(`PC ${width}×${height} の初期表示で全ピンが左パネルの右・ズームボタンの左・画面内に入る`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openMap(page);
      await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
      const panel = await page
        .getByTestId('regional-sponsor-desktop-panel')
        .boundingBox();
      const zoom = await page.locator('.leaflet-control-zoom').boundingBox();
      // 初期 fit は描画後に確定するため、確定した状態を待って検証する
      await expect
        .poll(async () => {
          const pins = await page
            .locator('.leaflet-marker-icon')
            .evaluateAll((elements) =>
              elements.map((element) => element.getBoundingClientRect()),
            );
          return (
            pins.length > 0 &&
            pins.every(
              (pin) =>
                pin.left >= panel!.x + panel!.width &&
                pin.right <= zoom!.x &&
                pin.top >= 0 &&
                pin.bottom <= height,
            )
          );
        })
        .toBe(true);
    });
  }

  test('PC 1100×900 の初期表示でタイル範囲外が見えない', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await openMap(page);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    const [[south, west], [north, east]] = REGIONAL_MAP_TILE_PROFILE.bounds;
    // 1pxは約2.5e-4度（z12.5）。サブピクセルの丸め誤差を許容する
    const tolerance = 5e-4;
    // 表示タイルのz/x/yと画面上の位置から、地図コンテナ四隅の緯度経度を求める
    await expect
      .poll(async () => {
        const view = await page.evaluate(() => {
          const container = document
            .querySelector('.leaflet-container')!
            .getBoundingClientRect();
          const tile = [
            ...document.querySelectorAll<HTMLImageElement>('.leaflet-tile'),
          ]
            .map((img) => ({
              match: /\/(\d+)\/(\d+)\/(\d+)\.webp/.exec(img.src),
              rect: img.getBoundingClientRect(),
            }))
            .find((t) => t.match);
          if (!tile) return null;
          const [z, x, y] = tile.match!.slice(1).map(Number);
          const size = tile.rect.width;
          const toLng = (px: number) =>
            ((x + (px - tile.rect.left) / size) / 2 ** z) * 360 - 180;
          const toLat = (py: number) => {
            const n =
              Math.PI -
              (2 * Math.PI * (y + (py - tile.rect.top) / size)) / 2 ** z;
            return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
          };
          return {
            north: toLat(container.top),
            south: toLat(container.bottom),
            west: toLng(container.left),
            east: toLng(container.right),
          };
        });
        return (
          view !== null &&
          view.north <= north + tolerance &&
          view.south >= south - tolerance &&
          view.west >= west - tolerance &&
          view.east <= east + tolerance
        );
      })
      .toBe(true);
  });

  test('最大zoomで数mだけ離れた企業は地点ピン1本になり、押すと地点の一覧を開く', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    await page
      .getByRole('button', {
        name: /2件の地域協賛：テスト専用雑貨店.*選択して拡大/,
      })
      .click();
    const locationPin = page.getByRole('button', {
      name: /2件の地域協賛：テスト専用雑貨店.*選択して一覧を表示/,
    });
    await locationPin.click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeFocused();
  });

  test('クラスタを押すと拡大し、元のクラスタが分かれる', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    const cluster = page
      .getByRole('button', { name: /件の地域協賛：.*選択して拡大/ })
      .first();
    const zoomOut = page.getByRole('button', { name: '縮小' });
    for (let i = 0; i < 6 && !(await cluster.isVisible()); i += 1) {
      await zoomOut.click();
    }
    await expect(cluster).toBeVisible();
    const label = await cluster.getAttribute('aria-label');
    await cluster.click();
    await expect(
      page.getByRole('button', { name: label!, exact: true }),
    ).toHaveCount(0);
  });

  test('スマートフォンで地点の一覧を開き、詳細からシートの戻り先へ戻る', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    await page
      .getByRole('button', { name: /2件の地域協賛：.*選択して一覧を表示/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeFocused();
    await expect(
      page.getByRole('button', { name: /現在: 標準/ }),
    ).toBeVisible();
    await expect(
      page
        .getByPlaceholder('店舗名・カテゴリ・住所で検索')
        .locator('visible=true'),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /テスト専用食堂A.*詳細を表示/ })
      .click();
    await expect(
      page.getByRole('button', { name: /現在: 標準/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /現在: 標準/ }),
    ).toBeVisible();
  });

  test('画像なし・画像失敗・タイル失敗でも一覧操作を継続する', async ({
    page,
  }) => {
    await page.unroute('**/regional-map-tiles/**');
    await page.route('**/regional-map-tiles/**', (route) =>
      route.fulfill({ status: 503, body: '' }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/sponsors/local', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 20_000,
    });

    const search = page
      .getByPlaceholder('店舗名・カテゴリ・住所で検索')
      .locator('visible=true');
    await search.fill('くらし商店');
    await expect(
      page.getByTestId('sponsor-image-placeholder').locator('visible=true'),
    ).toBeVisible();
    await search.fill('自動車工房');
    await expect(
      page.getByTestId('sponsor-image-placeholder').locator('visible=true'),
    ).toBeVisible();
    await expect(page.getByText('1件').locator('visible=true')).toBeVisible();
  });

  test('スマートフォンでsheet・カテゴリ・focus・横幅を保持する', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    const sheet = page.getByTestId('map-bottom-sheet');
    await expect(
      page.getByRole('button', { name: /現在: 標準/ }),
    ).toBeVisible();
    await expectMapControlsAboveSheet(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const listGrabber = page.getByRole('button', { name: /現在: 標準/ });
    await listGrabber.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: /現在: 大/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('button', { name: /現在: 標準/ }),
    ).toBeVisible();

    const card = page.getByRole('button', {
      name: /テスト専用あらまき病院.*詳細を表示/,
    });
    await card.click();
    await expect(
      page.getByRole('heading', { name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
    await expectMapControlsAboveSheet(page);
    await expectSelectedPinBetweenOverlays(page);
    const detailImage = await page
      .locator('article .aspect-video:visible')
      .boundingBox();
    expect(detailImage!.width / detailImage!.height).toBeCloseTo(16 / 9, 1);

    // 詳細を開いても選択前の高さを維持する。縮めると内容は操作対象外になり、戻すと戻る操作が使える
    const detailHeight = await sheet.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const detailGrabber = page.getByRole('button', { name: /現在: 標準/ });
    await detailGrabber.focus();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('button', { name: /現在: 最小/ }),
    ).toBeVisible();
    await expectMapControlsAboveSheet(page);
    await expect
      .poll(() =>
        sheet.evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeLessThan(detailHeight);
    await page.keyboard.press('ArrowUp');
    const back = page.getByRole('button', { name: '店舗一覧に戻る' });
    await expect(back).toBeVisible();
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(card).toBeFocused();

    const mobilePin = page.getByRole('button', {
      name: 'テスト専用あらまき病院、病院',
      exact: true,
    });
    await mobilePin.focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('heading', { name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
  });
});
