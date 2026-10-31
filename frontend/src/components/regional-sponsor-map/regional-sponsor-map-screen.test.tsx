import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigationItemsByPhase } from '@/lib/navigation';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  mapProps: [] as Record<string, unknown>[],
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/sponsors/local',
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockMapView(props: Record<string, unknown>) {
      mocks.mapProps.push(props);
      const sponsors = props.sponsors as readonly RegionalSponsor[];
      const onSelectSponsor = props.onSelectSponsor as (id: number) => void;
      const onSelectLocation = props.onSelectLocation as (key: string) => void;
      return (
        <div data-testid="regional-map-view">
          地図 {sponsors.length}件
          {sponsors[0] && (
            <button onClick={() => onSelectSponsor(sponsors[0]!.id)}>
              pin-select
            </button>
          )}
          {sponsors[0] && (
            <button
              onClick={() =>
                onSelectLocation(
                  sponsors
                    .filter(
                      (s) =>
                        s.latitude === sponsors[0]!.latitude &&
                        s.longitude === sponsors[0]!.longitude,
                    )
                    .map(({ id }) => id)
                    .join(','),
                )
              }
            >
              location-select
            </button>
          )}
        </div>
      );
    };
  },
}));

// メニュー自体のfocus trap・全ナビゲーションは専用テストで検証済み。
// この統合テストでは地域協賛画面の状態遷移だけを負荷競合なく検証する。
vi.mock('@/components/map/map-menu-button', () => ({
  MapMenuButton: () => <button type="button">メニューを開く</button>,
}));

vi.mock('@/lib/cms-asset-url', () => ({ toAssetUrl: () => null }));

import { RegionalSponsorMapScreen } from './regional-sponsor-map-screen';

function sponsor(overrides: Partial<RegionalSponsor> = {}): RegionalSponsor {
  return {
    id: 1,
    name: 'テスト専用店舗',
    category: 'shop',
    latitude: 36.4,
    longitude: 139.1,
    address: 'テスト県',
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    phone: null,
    websiteUrl: null,
    ...overrides,
  };
}

function matchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

// PC パネルの一覧は外側のスクロール領域(data-map-scroll-root)がスクロールする
function panelScrollRoot() {
  return screen
    .getByTestId('regional-sponsor-desktop-panel')
    .querySelector<HTMLElement>('[data-map-scroll-root]')!;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/sponsors/local');
  mocks.refresh.mockReset();
  mocks.mapProps.length = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('RegionalSponsorMapScreen', () => {
  it('PCパネルで検索・複数カテゴリ・一覧・詳細を同じ状態へ統合し、戻り先へfocusする', async () => {
    matchMedia(true);
    render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{
          ok: true,
          sponsors: [
            sponsor(),
            sponsor({
              id: 2,
              name: 'テスト病院',
              category: 'hospital',
            }),
          ],
        }}
      />,
    );

    expect(screen.getByTestId('regional-sponsor-desktop-panel')).toHaveClass(
      'w-[348px]',
    );
    expect(
      screen.getByTestId('map-bottom-sheet').closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'テスト' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^ショップ$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^病院$/ }));
    expect(screen.getByText('地図 2件')).toBeInTheDocument();
    const mapView = screen.getByTestId('regional-map-view');

    const card = screen.getByRole('button', { name: /テスト専用店舗.*詳細/ });
    fireEvent.click(card);
    expect(
      screen.getByRole('heading', { name: 'テスト専用店舗' }),
    ).toHaveFocus();
    expect(screen.getByTestId('regional-map-view')).toBe(mapView);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /テスト専用店舗.*詳細/ }),
      ).toHaveFocus(),
    );
    expect(screen.getByRole('searchbox')).toHaveValue('テスト');
    expect(screen.getByTestId('regional-map-view')).toBe(mapView);
  });

  it('ピン選択後に検索対象外になっても検索入力のfocusを奪わない', async () => {
    matchMedia(false);
    render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{ ok: true, sponsors: [sponsor()] }}
      />,
    );
    fireEvent.click(screen.getByText('pin-select'));
    expect(
      screen.getByRole('heading', { name: 'テスト専用店舗' }),
    ).toBeInTheDocument();

    const searchbox = screen.getByRole('searchbox');
    searchbox.focus();
    fireEvent.change(searchbox, { target: { value: '該当なし' } });
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'テスト専用店舗' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getAllByText('0件').length).toBeGreaterThan(0);
    expect(screen.getByText('地図 0件')).toBeInTheDocument();
    expect(searchbox).toHaveFocus();
  });

  it('スマートフォンでは検索欄とシートだけが操作対象で、検索条件を URL に載せる', async () => {
    matchMedia(false);
    render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{ ok: true, sponsors: [sponsor()] }}
      />,
    );
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(
      screen.getByTestId('regional-sponsor-desktop-panel'),
    ).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('map-bottom-sheet').style.height).toBe('380px');
    fireEvent.click(
      screen.getByRole('button', { name: /テスト専用店舗.*詳細/ }),
    );
    expect(window.location.search).toBe('?sponsor=1');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'テスト' },
    });
    await waitFor(() =>
      expect(window.location.search).toBe(
        '?q=%E3%83%86%E3%82%B9%E3%83%88&sponsor=1',
      ),
    );
  });

  it('URL の条件をマウント時に復元する', () => {
    window.history.replaceState(
      null,
      '',
      '/sponsors/local?category=hospital&sponsor=2',
    );
    matchMedia(true);
    render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{
          ok: true,
          sponsors: [
            sponsor(),
            sponsor({ id: 2, name: 'テスト病院', category: 'hospital' }),
          ],
        }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'テスト病院' }),
    ).toBeInTheDocument();
    expect(screen.getByText('地図 1件')).toBeInTheDocument();
  });

  it('詳細から戻っても一覧scroll位置を復元する', async () => {
    matchMedia(true);
    render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{
          ok: true,
          sponsors: [sponsor(), sponsor({ id: 2, name: '別のテスト店舗' })],
        }}
      />,
    );
    const list = panelScrollRoot();
    fireEvent.scroll(list, { target: { scrollTop: 120 } });
    fireEvent.click(
      screen.getByRole('button', { name: /テスト専用店舗.*詳細/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
    await waitFor(() => expect(panelScrollRoot().scrollTop).toBe(120));
  });

  it('0件とCMS取得失敗を区別し、失敗時の再試行でrouter.refreshする', () => {
    matchMedia(true);
    const { rerender } = render(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{ ok: true, sponsors: [] }}
      />,
    );
    expect(
      screen.getAllByText('掲載可能な地域協賛情報はありません。').length,
    ).toBeGreaterThan(0);

    rerender(
      <RegionalSponsorMapScreen
        navigation={navigationItemsByPhase}
        data={{ ok: false, error: 'unavailable' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('取得できませんでした');
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByTestId('regional-map-view')).toBeInTheDocument();
  });

  describe('地点の一覧', () => {
    const sponsors = [
      sponsor({ id: 1, name: '同地点A' }),
      sponsor({ id: 2, name: '同地点B' }),
      sponsor({ id: 3, name: '別地点C', latitude: 36.5, longitude: 139.2 }),
    ];
    const renderScreen = () =>
      render(
        <RegionalSponsorMapScreen
          navigation={navigationItemsByPhase}
          data={{ ok: true, sponsors }}
        />,
      );

    it('同一座標ピンで、その座標の企業だけを見出し付きで表示し、見出しへfocusする', async () => {
      matchMedia(true);
      renderScreen();
      const mapView = screen.getByTestId('regional-map-view');
      fireEvent.click(screen.getByText('location-select'));

      const title = await screen.findByRole('heading', {
        name: 'この地点の地域協賛2件',
      });
      await waitFor(() => expect(title).toHaveFocus());
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.getByText('地図 3件')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /同地点A/ })).toBeVisible();
      expect(screen.getByRole('button', { name: /同地点B/ })).toBeVisible();
      expect(
        screen.queryByRole('button', { name: /別地点C/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('regional-map-view')).toBe(mapView);
    });

    it('戻るは検索語を保ったまま全体の一覧へ戻り、一覧見出しへfocusする', async () => {
      matchMedia(true);
      renderScreen();
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: '地点' },
      });
      fireEvent.click(screen.getByText('location-select'));
      fireEvent.click(
        await screen.findByRole('button', { name: '店舗一覧に戻る' }),
      );
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: '地域協賛' })).toHaveFocus(),
      );
      expect(screen.getByRole('searchbox')).toHaveValue('地点');
      expect(screen.getAllByText('3件').length).toBeGreaterThan(0);
    });

    it('詳細の戻り先は地点の一覧で、起点カードへfocusし、地点の一覧のscrollを復元する', async () => {
      matchMedia(true);
      renderScreen();
      fireEvent.click(screen.getByText('location-select'));
      await screen.findByRole('heading', { name: 'この地点の地域協賛2件' });
      fireEvent.scroll(panelScrollRoot(), { target: { scrollTop: 80 } });
      fireEvent.click(screen.getByRole('button', { name: /同地点B/ }));
      expect(
        screen.getByRole('heading', { name: '同地点B' }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /同地点B/ })).toHaveFocus(),
      );
      expect(
        screen.getByRole('heading', { name: 'この地点の地域協賛2件' }),
      ).toBeInTheDocument();
      expect(panelScrollRoot().scrollTop).toBe(80);
    });

    it('地点の一覧に新しく入るときは先頭から表示する', async () => {
      matchMedia(true);
      renderScreen();
      fireEvent.click(screen.getByText('location-select'));
      await screen.findByRole('heading', { name: 'この地点の地域協賛2件' });
      fireEvent.scroll(panelScrollRoot(), { target: { scrollTop: 80 } });
      fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
      fireEvent.click(await screen.findByText('location-select'));
      await waitFor(() => expect(panelScrollRoot().scrollTop).toBe(0));
    });

    it('地点の一覧の表示中にピンから詳細を開くと、全体の一覧へ戻る', async () => {
      matchMedia(true);
      renderScreen();
      fireEvent.click(screen.getByText('location-select'));
      await screen.findByRole('heading', { name: 'この地点の地域協賛2件' });
      fireEvent.click(screen.getByText('pin-select'));
      fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
      expect(
        await screen.findByRole('heading', { name: '地域協賛' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('地点の該当が0件になったら全体の一覧へ戻る', async () => {
      matchMedia(false);
      renderScreen();
      fireEvent.click(screen.getByText('location-select'));
      await screen.findByRole('heading', { name: 'この地点の地域協賛2件' });
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: '別地点' },
      });
      expect(
        await screen.findByRole('heading', { name: '地域協賛' }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('1件').length).toBeGreaterThan(0);
    });

    it('地点の一覧から開いた詳細が対象外になっても、地点に該当が残れば地点の一覧へ戻る', async () => {
      matchMedia(false);
      renderScreen();
      fireEvent.click(screen.getByText('location-select'));
      fireEvent.click(await screen.findByRole('button', { name: /同地点A/ }));
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: '同地点B' },
      });
      expect(
        await screen.findByRole('heading', { name: 'この地点の地域協賛1件' }),
      ).toBeInTheDocument();
    });
  });
});
