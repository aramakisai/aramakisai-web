import { createServer, type Server } from 'node:http';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { REGIONAL_MAP_TILE_PROFILE } from '../src/lib/map-tile-profile';

const CMS_PORT = 18055;
const CMS_ORIGIN = `http://127.0.0.1:${CMS_PORT}`;
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
);

type CmsMode = 'ok' | 'error';
let cmsMode: CmsMode = 'ok';
let cmsServer: Server;

const baseSponsor = {
  type: ['local'],
  logo: null,
  url: null,
  description: null,
  business_category: null,
  local_import_id: null,
  local_image: null,
  local_image_alt: null,
  local_image_decorative: false,
  local_business_hours: null,
  local_closed_days: null,
  local_phone: null,
  local_image_checksum: null,
  tier: null,
  area_id: null,
  booth_number: null,
  booth_label: null,
  updatedAt: '2026-10-22T00:00:00.000Z',
  createdAt: '2026-10-22T00:00:00.000Z',
};

const sponsorFixtures = [
  {
    ...baseSponsor,
    id: 101,
    _order: 'a01',
    name: 'テスト専用あらまき病院',
    local_map_category: 'hospital',
    local_latitude: 36.41,
    local_longitude: 139.1,
    address: '群馬県テスト市中央1-1',
    local_image: 201,
    local_image_alt: 'テスト専用病院の外観',
    description: '地域のみなさまを応援します。\nテスト専用メッセージです。',
    local_business_hours: '9:00〜17:00',
    local_closed_days: '日曜日',
    local_phone: '027-000-0000',
    url: 'https://example.invalid/hospital',
  },
  {
    ...baseSponsor,
    id: 102,
    _order: 'a02',
    name: 'テスト専用くらし商店',
    local_map_category: 'life',
    local_latitude: 36.43,
    local_longitude: 139.16,
    address: '群馬県テスト市くらし2-2',
  },
  {
    ...baseSponsor,
    id: 103,
    _order: 'a03',
    name: 'テスト専用自動車工房',
    local_map_category: 'car',
    local_latitude: 36.38,
    local_longitude: 139.16,
    address: '群馬県テスト市くるま3-3',
    local_image: 202,
    local_image_alt: '読込失敗確認用画像',
  },
  {
    ...baseSponsor,
    id: 104,
    _order: 'a04',
    name: 'テスト専用学習塾',
    local_map_category: 'education',
    local_latitude: 36.45,
    local_longitude: 139.08,
    address: '群馬県テスト市まなび4-4',
  },
  {
    ...baseSponsor,
    id: 105,
    _order: 'a05',
    name: 'テスト専用食堂A',
    local_map_category: 'food',
    local_latitude: 36.405,
    local_longitude: 139.125,
    address: '群馬県テスト市同一座標5-5',
  },
  {
    ...baseSponsor,
    id: 106,
    _order: 'a06',
    name: 'テスト専用食堂B',
    local_map_category: 'food',
    local_latitude: 36.405,
    local_longitude: 139.125,
    address: '群馬県テスト市同一座標5-5',
  },
  {
    ...baseSponsor,
    id: 107,
    _order: 'a07',
    name: 'テスト専用雑貨店',
    local_map_category: 'shop',
    local_latitude: 36.37,
    local_longitude: 139.075,
    address: '群馬県テスト市おみせ7-7',
  },
  {
    ...baseSponsor,
    id: 109,
    _order: 'a09',
    name: 'テスト専用雑貨店B',
    local_map_category: 'shop',
    local_latitude: 36.37003,
    local_longitude: 139.075,
    address: '群馬県テスト市おみせ7-7',
  },
  {
    ...baseSponsor,
    id: 108,
    _order: 'a08',
    name: '除外確認用不正fixture',
    local_map_category: 'shop',
    local_latitude: 999,
    local_longitude: 139.1,
    address: '公開されないテスト専用住所',
  },
];

function startCmsFixtureServer(): Promise<void> {
  cmsServer = createServer((request, response) => {
    const url = new URL(request.url ?? '/', CMS_ORIGIN);
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (url.pathname === '/api/sponsors') {
      if (cmsMode === 'error') {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'fixture unavailable' }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          docs: sponsorFixtures,
          totalDocs: sponsorFixtures.length,
        }),
      );
      return;
    }
    if (url.pathname.startsWith('/api/media/serve/201/')) {
      response.writeHead(200, { 'Content-Type': 'image/png' });
      response.end(ONE_PIXEL_PNG);
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'fixture not found' }));
  });
  return new Promise((resolve, reject) => {
    cmsServer.once('error', reject);
    cmsServer.listen(CMS_PORT, '127.0.0.1', resolve);
  });
}

function stopCmsFixtureServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    cmsServer.close((error) => (error ? reject(error) : resolve()));
  });
}

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

async function stabilizeVisual(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      'nextjs-portal{display:none!important} *{caret-color:transparent!important}',
  });
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
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
        const corners = [
          ...document.querySelectorAll<HTMLElement>(
            '.regional-sponsor-map .leaflet-bottom',
          ),
        ];
        if (!sheet || !attribution || !zoom || corners.length === 0) {
          return false;
        }
        const sheetBox = sheet.getBoundingClientRect();
        const controls = [attribution, zoom].map((element) =>
          element.getBoundingClientRect(),
        );
        return (
          controls.every(
            (box) =>
              box.width > 0 &&
              box.height > 0 &&
              box.top >= 0 &&
              box.bottom <= sheetBox.top,
          ) &&
          corners.every((corner) => {
            const style = getComputedStyle(corner);
            return (
              parseFloat(style.bottom) >= sheetBox.height - 0.5 &&
              style.transitionDuration === '0s'
            );
          })
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

test.describe('地域協賛マップ fixture E2E', { tag: '@local-fixture' }, () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeAll(async () => startCmsFixtureServer());
  test.afterAll(async () => stopCmsFixtureServer());
  test.beforeEach(async ({ page }) => {
    cmsMode = 'ok';
    await useFixtureTiles(page);
  });

  test('CMS取得失敗を通知し、再試行で一覧を復元する', async ({ page }) => {
    cmsMode = 'error';
    await page.goto('/sponsors/local', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('alert').filter({
        hasText: '地域協賛情報を取得できませんでした。',
      }),
    ).toBeVisible();
    cmsMode = 'ok';
    await page.getByRole('button', { name: '再試行' }).click();
    await expect(page.getByText('8件')).toBeVisible();
  });

  test('PCで検索・複数カテゴリ・0件・詳細・戻り状態を統合する', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    const search = page.getByPlaceholder('店舗名・カテゴリ・住所で検索');
    await expect(page.getByText('8件')).toBeVisible();

    await search.fill('中央1-1');
    await expect(page.getByText('1件')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /テスト専用あらまき病院.*詳細を表示/ }),
    ).toBeVisible();
    await search.fill('');

    const hospital = page.getByRole('button', { name: '病院', exact: true });
    const food = page.getByRole('button', { name: '飲食', exact: true });
    await hospital.click();
    await food.click();
    await expect(page.getByText('3件')).toBeVisible();
    await expect(hospital).toHaveAttribute('aria-pressed', 'true');
    await expect(food).toHaveAttribute('aria-pressed', 'true');

    const hospitalCard = page.getByRole('button', {
      name: /テスト専用あらまき病院.*詳細を表示/,
    });
    await hospitalCard.click();
    const detailHeading = page.getByRole('heading', {
      level: 1,
      name: 'テスト専用あらまき病院',
    });
    await expect(detailHeading).toBeFocused();
    const panel = page.getByTestId('regional-sponsor-desktop-panel');
    await expect
      .poll(async () => {
        const [pinBox, panelBox] = await Promise.all([
          page
            .locator('.leaflet-marker-icon[aria-current="true"]')
            .boundingBox(),
          panel.boundingBox(),
        ]);
        return Boolean(
          pinBox && panelBox && pinBox.x >= panelBox.x + panelBox.width,
        );
      })
      .toBe(true);
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(hospitalCard).toBeFocused();
    await expect(hospital).toHaveAttribute('aria-pressed', 'true');
    await expect(food).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'すべて', exact: true }).click();
    await search.fill('一致しない検索語');
    await expect(page.getByText('0件')).toBeVisible();
    await expect(
      page.getByText(/条件に一致する地域協賛はありません/),
    ).toBeVisible();

    await search.fill('');
    await search.focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'すべて', exact: true }),
    ).toBeFocused();
  });

  test('単独ピンから同じ詳細へ遷移する', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);

    await page
      .getByRole('button', {
        name: /テスト専用あらまき病院.*詳細を表示/,
      })
      .click();
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    const pin = page.getByRole('button', {
      name: 'テスト専用あらまき病院、病院',
      exact: true,
    });
    await pin.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
    await expect(pin).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await pin.focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('heading', { name: 'テスト専用あらまき病院' }),
    ).toBeFocused();
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
  });

  test('同一座標ピンは地点の一覧を開き、詳細の戻り先と状態を保つ', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openMap(page);
    const search = page.getByPlaceholder('店舗名・カテゴリ・住所で検索');
    await search.fill('テスト専用');
    const food = page.getByRole('button', { name: '飲食', exact: true });
    await food.click();

    const locationPin = page.getByRole('button', {
      name: /2件の地域協賛：テスト専用食堂A（飲食）、テスト専用食堂B（飲食）。選択して一覧を表示/,
    });
    const center = async () =>
      page.evaluate(() => {
        const box = document
          .querySelector('.leaflet-map-pane')
          ?.getBoundingClientRect();
        return box ? [box.x, box.y] : null;
      });
    const before = await center();
    await locationPin.click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeFocused();
    expect(await center()).toEqual(before);
    await expect(search).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /テスト専用食堂[AB].*詳細を表示/ }),
    ).toHaveCount(2);
    await expect(locationPin).toBeVisible();

    const cardB = page.getByRole('button', {
      name: /テスト専用食堂B.*詳細を表示/,
    });
    await cardB.click();
    await expect(
      page.getByRole('heading', { name: 'テスト専用食堂B' }),
    ).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'テスト専用食堂B、飲食', exact: true }),
    ).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(cardB).toBeFocused();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeVisible();

    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(page.getByRole('heading', { name: '地域協賛' })).toBeFocused();
    await expect(search).toHaveValue('テスト専用');
    await expect(food).toHaveAttribute('aria-pressed', 'true');

    await page
      .getByRole('button', { name: /テスト専用食堂A.*詳細を表示/ })
      .click();
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(
      page.getByRole('heading', { name: '地域協賛', exact: true }),
    ).toBeVisible();
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
      await page.waitForTimeout(500);
      const panel = await page
        .getByTestId('regional-sponsor-desktop-panel')
        .boundingBox();
      const zoom = await page.locator('.leaflet-control-zoom').boundingBox();
      const pins = await page
        .locator('.leaflet-marker-icon')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            return {
              left: box.left,
              right: box.right,
              top: box.top,
              bottom: box.bottom,
            };
          }),
        );
      expect(pins.length).toBeGreaterThan(0);
      for (const pin of pins) {
        expect(pin.left).toBeGreaterThanOrEqual(panel!.x + panel!.width);
        expect(pin.right).toBeLessThanOrEqual(zoom!.x);
        expect(pin.top).toBeGreaterThanOrEqual(0);
        expect(pin.bottom).toBeLessThanOrEqual(height);
      }
    });
  }

  test('PC 800×1000 の初期表示でタイル範囲外が見えない', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1000 });
    await openMap(page);
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
    await page.waitForTimeout(500);
    // 表示タイルのz/x/yと画面上の位置から、地図コンテナ四隅の緯度経度を求める
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
      const [z, x, y] = tile!.match!.slice(1).map(Number);
      const size = tile!.rect.width;
      const toLng = (px: number) =>
        ((x + (px - tile!.rect.left) / size) / 2 ** z) * 360 - 180;
      const toLat = (py: number) => {
        const n =
          Math.PI - (2 * Math.PI * (y + (py - tile!.rect.top) / size)) / 2 ** z;
        return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
      };
      return {
        north: toLat(container.top),
        south: toLat(container.bottom),
        west: toLng(container.left),
        east: toLng(container.right),
      };
    });
    const [[south, west], [north, east]] = REGIONAL_MAP_TILE_PROFILE.bounds;
    // 1pxは約2.5e-4度（z12.5）。サブピクセルの丸め誤差を許容する
    const tolerance = 5e-4;
    expect(view.north).toBeLessThanOrEqual(north + tolerance);
    expect(view.south).toBeGreaterThanOrEqual(south - tolerance);
    expect(view.west).toBeGreaterThanOrEqual(west - tolerance);
    expect(view.east).toBeLessThanOrEqual(east + tolerance);
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
    await expect(locationPin).toHaveCount(1);
    await locationPin.click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeFocused();
    await expect(
      page.getByRole('button', { name: /テスト専用雑貨店.*詳細を表示/ }),
    ).toHaveCount(2);
  });

  test('クラスタは押すと地図が寄るだけで画面状態を変えない', async ({
    page,
  }) => {
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
    const zoomOf = () =>
      page.evaluate(() => {
        const transform =
          document.querySelector<HTMLElement>('.leaflet-tile-container')?.style
            .transform ?? '';
        return transform;
      });
    const before = await zoomOf();
    await cluster.click();
    await expect(page.getByRole('heading', { name: '地域協賛' })).toBeVisible();
    await expect.poll(zoomOf).not.toBe(before);
    await expect(
      page.getByPlaceholder('店舗名・カテゴリ・住所で検索'),
    ).toBeVisible();
  });

  test('スマートフォンで地点の一覧を一覧snapで開き、詳細からシートの戻り先へ戻る', async ({
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
      page.getByRole('button', { name: /現在: 一覧/ }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('店舗名・カテゴリ・住所で検索'),
    ).toBeVisible();
    await page
      .getByRole('button', { name: /テスト専用食堂A.*詳細を表示/ })
      .click();
    await expect(
      page.getByRole('button', { name: /現在: 詳細/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: '店舗一覧に戻る' }).click();
    await expect(
      page.getByRole('heading', { name: 'この地点の地域協賛2件' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /現在: 一覧/ }),
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
    await expect(
      page.getByText(/地図タイルを読み込めませんでした/),
    ).toBeVisible({
      timeout: 20_000,
    });

    const search = page.getByPlaceholder('店舗名・カテゴリ・住所で検索');
    await search.fill('くらし商店');
    await expect(page.getByTestId('sponsor-image-placeholder')).toBeVisible();
    await search.fill('自動車工房');
    await expect(page.getByTestId('sponsor-image-placeholder')).toBeVisible();
    await expect(page.getByText('1件')).toBeVisible();
  });

  test('スマートフォンでsheet・カテゴリ・focus・横幅を保持する', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    const sheet = page.getByTestId('map-bottom-sheet');
    await expect(
      page.getByRole('button', { name: /現在: 一覧/ }),
    ).toBeVisible();
    await expectMapControlsAboveSheet(page);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const listGrabber = page.getByRole('button', { name: /現在: 一覧/ });
    await listGrabber.focus();
    await page.keyboard.press('ArrowUp');
    await expect(
      page.getByRole('button', { name: /現在: 展開/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /現在: 詳細/ })).toHaveCount(
      0,
    );
    await expectMapControlsAboveSheet(page);
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('button', { name: /現在: 一覧/ }),
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

    const detailHeight = await sheet.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const detailGrabber = page.getByRole('button', { name: /現在: 詳細/ });
    await detailGrabber.focus();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('button', { name: /現在: 一覧/ }),
    ).toBeVisible();
    await expectMapControlsAboveSheet(page);
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('button', { name: /現在: 縮小/ }),
    ).toBeVisible();
    await expectMapControlsAboveSheet(page);
    expect(
      await sheet.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThan(detailHeight);
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

  test('Figma比較用PC一覧・詳細を1440×900で撮影する', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMap(page);
    await stabilizeVisual(page);
    const panelBox = await page
      .getByTestId('regional-sponsor-desktop-panel')
      .boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThan(0);
    expect(panelBox!.y).toBeGreaterThan(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThan(1440 / 2);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(900);
    await capture(page, testInfo, 'regional-pc-list-1440x900');
    await page
      .getByRole('button', { name: /テスト専用あらまき病院.*詳細を表示/ })
      .click();
    await expect(
      page.getByRole('button', { name: '店舗一覧に戻る' }),
    ).toBeVisible();
    await capture(page, testInfo, 'regional-pc-detail-1440x900');
  });

  test('Figma比較用スマートフォン一覧・詳細を390×844で撮影する', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    await stabilizeVisual(page);
    const searchBox = await page
      .getByPlaceholder('店舗名・カテゴリ・住所で検索')
      .boundingBox();
    const listSheetBox = await page
      .getByTestId('map-bottom-sheet')
      .boundingBox();
    expect(searchBox).not.toBeNull();
    expect(listSheetBox).not.toBeNull();
    expect(searchBox!.x).toBeGreaterThan(0);
    expect(searchBox!.y).toBeGreaterThan(0);
    expect(searchBox!.x + searchBox!.width).toBeLessThan(390);
    expect(listSheetBox!.y).toBeGreaterThan(searchBox!.y + searchBox!.height);
    expect(listSheetBox!.y + listSheetBox!.height).toBeCloseTo(844, 0);
    await capture(page, testInfo, 'regional-mobile-list-390x844');
    await page
      .getByRole('button', { name: /テスト専用あらまき病院.*詳細を表示/ })
      .click();
    await expect(
      page.getByPlaceholder('店舗名・カテゴリ・住所で検索'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '店舗一覧に戻る' }),
    ).toBeVisible();
    const detailSheetBox = await page
      .getByTestId('map-bottom-sheet')
      .boundingBox();
    const detailImageBox = await page
      .locator('article .aspect-video')
      .boundingBox();
    expect(detailSheetBox).not.toBeNull();
    expect(detailImageBox).not.toBeNull();
    expect(detailSheetBox!.y).toBeGreaterThan(searchBox!.y + searchBox!.height);
    expect(detailSheetBox!.y + detailSheetBox!.height).toBeCloseTo(844, 0);
    expect(detailImageBox!.x).toBeGreaterThan(detailSheetBox!.x);
    expect(detailImageBox!.x + detailImageBox!.width).toBeLessThan(
      detailSheetBox!.x + detailSheetBox!.width,
    );
    expect(detailImageBox!.y).toBeGreaterThan(detailSheetBox!.y);
    expect(detailImageBox!.width / detailImageBox!.height).toBeCloseTo(
      16 / 9,
      1,
    );
    await capture(page, testInfo, 'regional-mobile-detail-390x844');
  });
});
