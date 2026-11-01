import { expect, test, type Page } from '@playwright/test';
import { checkCmsReachable } from '../scripts/cms-check';

// Depends on CMS collections: map_areas, student_exhibitions, performance_slots, stages, topics, announcements

const EXISTING_LIST_PAGES = ['/', '/announcements', '/topics'] as const;

// festival-phase-gate により開催前フェーズでは非公開。(site)/gated 経由の 404 になる
// (design.md: gated ルートは (site) 配下に置きヘッダー・フッター付きの通常の 404 に揃える)
const GATED_LIST_PAGES = ['/exhibitions'] as const;

/** 地図の動的読み込みが終わるまで待つ (読み込み中は role="status" のプレースホルダーが出る) */
async function waitForMapReady(page: Page): Promise<void> {
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 15000 });
}

/**
 * 選択可能なエリアポリゴン (SVG path)。キーボード選択のため role="button" を持つ。
 * エリア名ラベルやサイドパネルがポリゴン中心に重なり得るため、選択は実クリックではなく
 * dispatchEvent('click') で行う
 */
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

  for (const path of GATED_LIST_PAGES) {
    test(`${path} は開催前フェーズで非公開になりヘッダーとフッター付きの404を返す`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        {
          name: 'aramakisai_phase_override',
          value: 'pre_event',
          url: baseURL!,
        },
      ]);
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ページが見つかりません',
    );
  });

  test('地図上に出典表記が表示され、ライセンス情報ページへのリンクを持つ', async ({
    page,
  }) => {
    const response = await page.goto('/map');
    if (response?.status() === 404) {
      test.skip(
        true,
        '開催前フェーズでは /map が非公開のため検証できません (festival-phase-gate)',
      );
    }
    const attribution = page.locator('.leaflet-control-attribution');
    await expect(attribution).toContainText('OpenStreetMap');
    await expect(
      attribution.getByRole('link', { name: 'OpenStreetMap' }),
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  });

  test('ポリゴンを選ぶとURLとリストが切り替わり、再読み込みは発生しない。再度選ぶと未選択の案内に戻る', async ({
    page,
    baseURL,
  }) => {
    await openMapWithPhase(page, baseURL!);

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

    await polygon.dispatchEvent('click');

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

    await polygon.dispatchEvent('click');

    await expect(page).not.toHaveURL(/[?&]area=\d+\b/);
    await expect(
      page.locator('p:visible', { hasText: '地図上のブロックをタップすると' }),
    ).toBeVisible();
  });

  test('エリアを選択した後の戻る操作で選択前の状態に戻る', async ({
    page,
    baseURL,
  }) => {
    await openMapWithPhase(page, baseURL!);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため選択操作を検証できません',
      );
    }

    await polygons(page).first().dispatchEvent('click');
    await expect(page).toHaveURL(/[?&]area=\d+\b/);

    await page.goBack();

    await expect(page).not.toHaveURL(/[?&]area=\d+\b/);
    await expect(
      page.locator('p:visible', { hasText: '地図上のブロックをタップすると' }),
    ).toBeVisible();
  });

  test('出展物タイルから企画詳細ページへ遷移できる', async ({
    page,
    baseURL,
  }) => {
    await openMapWithPhase(page, baseURL!);

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
      await polygons(page).nth(i).dispatchEvent('click');
      if ((await card.count()) > 0) {
        found = true;
        break;
      }
      // このエリアに出展物がなかったので選択解除して次のエリアを試す
      await polygons(page).nth(i).dispatchEvent('click');
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
    baseURL,
  }) => {
    // タイル資産はまだ生成されていない環境もあるため、意図的に 404 させて条件を固定する
    await page.route('**/map-tiles/**', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );

    await openMapWithPhase(page, baseURL!);

    const areaCount = await polygons(page).count();
    if (areaCount === 0) {
      test.skip(
        true,
        '有効な図形を持つエリアが登録されていないため検証できません',
      );
    }
    const polygon = polygons(page).first();
    const areaName = await polygon.getAttribute('aria-label');

    await polygon.dispatchEvent('click');

    await expect(page).toHaveURL(/[?&]area=\d+\b/);
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      areaName ?? '',
    );
  });
});

// 開催前フェーズでは /map が非公開のため、開発サーバーのフェーズ上書き Cookie で公開状態にする
const PHASE_LIVE_COOKIE = {
  name: 'aramakisai_phase_override',
  value: 'live',
};

// CAMPUS_MAP_CONFIG.campusBounds の内側と外側
const ON_CAMPUS = { latitude: 36.4307, longitude: 139.0448, accuracy: 30 };
const OFF_CAMPUS = { latitude: 35.0, longitude: 139.0, accuracy: 30 };

const LOCATE_BUTTON = { name: '現在地を表示' } as const;
const FAILURE_MESSAGE = '現在地を取得できませんでした';

async function openMapWithPhase(page: Page, base: string): Promise<void> {
  await page.context().addCookies([{ ...PHASE_LIVE_COOKIE, url: base }]);
  await page.goto('/map');
  await waitForMapReady(page);
}

function userDot(page: Page) {
  return page.locator('.leaflet-userLocation-pane .leaflet-marker-icon');
}

async function center(locator: ReturnType<Page['locator']>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('現在地の表示', () => {
  test.beforeEach(({ baseURL }) => {
    test.skip(!baseURL, 'baseURL が必要です');
  });

  test('開いただけでは位置情報を求めず、押すと取得中になり点が中央付近に出る', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['geolocation'], { origin: baseURL! });
    await context.setGeolocation(ON_CAMPUS);
    await page.addInitScript(() => {
      const w = window as unknown as { __geoCalls: number };
      w.__geoCalls = 0;
      const geo = navigator.geolocation;
      const origGet = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = (...args) => {
        w.__geoCalls++;
        return origGet(...args);
      };
      const origWatch = geo.watchPosition.bind(geo);
      geo.watchPosition = (...args) => {
        w.__geoCalls++;
        return origWatch(...args);
      };
    });
    await openMapWithPhase(page, baseURL!);

    const button = page.getByRole('button', LOCATE_BUTTON);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(userDot(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { __geoCalls: number }).__geoCalls,
      ),
    ).toBe(0);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(userDot(page)).toHaveCount(1);

    const mapCenter = await center(page.locator('.leaflet-container'));
    await expect
      .poll(async () => {
        const d = await center(userDot(page));
        return Math.hypot(d.x - mapCenter.x, d.y - mapCenter.y);
      })
      .toBeLessThan(40);
  });

  test('地図をずらして現在地が離れても、もう一度押すと縮尺を変えず中央付近に戻る', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.grantPermissions(['geolocation'], { origin: baseURL! });
    await context.setGeolocation(ON_CAMPUS);
    await openMapWithPhase(page, baseURL!);

    const button = page.getByRole('button', LOCATE_BUTTON);
    await button.click();
    await expect(userDot(page)).toHaveCount(1);

    const container = page.locator('.leaflet-container');
    const mapCenter = await center(container);
    const widthBefore = (
      await page.locator('.leaflet-overlay-pane svg path').first().boundingBox()
    )?.width;

    for (let i = 0; i < 3; i++) {
      await page.mouse.move(mapCenter.x + 200, mapCenter.y);
      await page.mouse.down();
      await page.mouse.move(mapCenter.x - 100, mapCenter.y - 100, { steps: 8 });
      await page.mouse.up();
    }
    await expect
      .poll(async () => {
        const d = await center(userDot(page));
        return Math.hypot(d.x - mapCenter.x, d.y - mapCenter.y);
      })
      .toBeGreaterThan(150);

    await button.click();
    await expect
      .poll(async () => {
        const d = await center(userDot(page));
        return Math.hypot(d.x - mapCenter.x, d.y - mapCenter.y);
      })
      .toBeLessThan(40);
    const widthAfter = (
      await page.locator('.leaflet-overlay-pane svg path').first().boundingBox()
    )?.width;
    expect(widthAfter).toBeCloseTo(widthBefore!, 1);
  });
});

test.describe('現在地ボタンの位置と取得失敗', () => {
  for (const [label, viewport] of [
    ['SP', { width: 390, height: 844 }],
    ['PC', { width: 1440, height: 900 }],
  ] as const) {
    test(`${label}: ボタンの下端がズームの上端の8px上で右端が一致する`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize(viewport);
      await openMapWithPhase(page, baseURL!);

      const button = (await page
        .getByRole('button', LOCATE_BUTTON)
        .boundingBox())!;
      const zoom = (await page.locator('.leaflet-control-zoom').boundingBox())!;
      expect(zoom.y - (button.y + button.height)).toBeCloseTo(8, 0);
      expect(button.x + button.width).toBeCloseTo(zoom.x + zoom.width, 0);
    });
  }

  test('エリア選択時と検索結果の表示中もボタンが表示される', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openMapWithPhase(page, baseURL!);
    const button = page.getByRole('button', LOCATE_BUTTON);

    if ((await polygons(page).count()) > 0) {
      // エリア名ラベルがポリゴン上に重なり得るため、実クリックではなくイベント送出で選択する
      await polygons(page).first().dispatchEvent('click');
      await expect(page).toHaveURL(/[?&]area=\d+\b/);
      await expect(button).toBeVisible();
    }

    await page.locator('input[type="search"]:visible').first().fill('a');
    await expect(button).toBeVisible();
  });

  for (const [label, setup] of [
    ['構外の座標', 'off'],
    ['位置情報の不許可', 'denied'],
  ] as const) {
    test(`${label}ではリンク無しのトーストが下端80pxに出て、取得中に戻らない`, async ({
      page,
      context,
      baseURL,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      if (setup === 'off') {
        await context.grantPermissions(['geolocation'], { origin: baseURL! });
        await context.setGeolocation(OFF_CAMPUS);
      }
      await openMapWithPhase(page, baseURL!);

      await page.getByRole('button', LOCATE_BUTTON).click();

      const toast = page
        .getByRole('status')
        .filter({ hasText: FAILURE_MESSAGE });
      await expect(toast).toBeVisible();
      await expect(toast.getByRole('link')).toHaveCount(0);
      // 入場 transition (translate) が終わるまで位置が動くため、収束を待って測る
      await expect
        .poll(async () => {
          const box = (await toast.boundingBox())!;
          return Math.round(844 - (box.y + box.height));
        })
        .toBe(80);
      await expect(page.getByRole('button', LOCATE_BUTTON)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(userDot(page)).toHaveCount(0);
    });
  }
});
