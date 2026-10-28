import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigationItemsByPhase } from '@/lib/navigation';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  mapProps: [] as Record<string, unknown>[],
  dynamicOptions: undefined as
    { ssr?: boolean; loading?: () => ReactNode } | undefined,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/sponsors/local',
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('next/dynamic', () => ({
  default: (
    _loader: unknown,
    options?: { ssr?: boolean; loading?: () => ReactNode },
  ) => {
    mocks.dynamicOptions = options;
    return function MockMapView(props: Record<string, unknown>) {
      mocks.mapProps.push(props);
      const sponsors = props.sponsors as readonly RegionalSponsor[];
      const onSelectSponsor = props.onSelectSponsor as (id: number) => void;
      return (
        <div data-testid="regional-map-view">
          地図 {sponsors.length}件
          {sponsors[0] && (
            <button onClick={() => onSelectSponsor(sponsors[0]!.id)}>
              pin-select
            </button>
          )}
        </div>
      );
    };
  },
}));

// メニュー自体のfocus trap・全ナビゲーションは専用テストで検証済み。
// この統合テストでは地域協賛画面の状態遷移だけを負荷競合なく検証する。
vi.mock('@/components/campus-map/map-menu-button', () => ({
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
    closedDays: null,
    phone: null,
    websiteUrl: null,
    order: 0,
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

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.mapProps.length = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

describe('RegionalSponsorMapScreen', () => {
  it('Leaflet部分だけをSSR無効で遅延読込する', () => {
    matchMedia(true);
    render(<RegionalSponsorMapScreen navigation={navigationItemsByPhase} data={{ ok: true, sponsors: [] }} />);
    expect(mocks.dynamicOptions?.ssr).toBe(false);
    render(<>{mocks.dynamicOptions?.loading?.()}</>);
    expect(screen.getByText('地図を読み込んでいます…')).toBeInTheDocument();
  });

  it('PCパネルで検索・複数カテゴリ・一覧・詳細を同じ状態へ統合し、戻り先へfocusする', async () => {
    matchMedia(true);
    render(
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase}
        data={{
          ok: true,
          sponsors: [
            sponsor(),
            sponsor({
              id: 2,
              name: 'テスト病院',
              category: 'hospital',
              order: 1,
            }),
          ],
        }}
      />,
    );

    expect(screen.getByTestId('regional-sponsor-desktop-panel')).toHaveClass(
      'w-[348px]',
    );
    expect(screen.queryByTestId('map-bottom-sheet')).not.toBeInTheDocument();
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
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase} data={{ ok: true, sponsors: [sponsor()] }} />,
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
    expect(screen.getByText('0件')).toBeInTheDocument();
    expect(screen.getByText('地図 0件')).toBeInTheDocument();
    expect(searchbox).toHaveFocus();
  });

  it('スマートフォンでは上部操作と45dvhの一覧sheet、詳細用snapを使う', async () => {
    matchMedia(false);
    render(
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase} data={{ ok: true, sponsors: [sponsor()] }} />,
    );
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
    expect(
      screen.queryByTestId('regional-sponsor-desktop-panel'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('map-bottom-sheet').style.height).toBe('45dvh');
    fireEvent.click(
      screen.getByRole('button', { name: /テスト専用店舗.*詳細/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /現在: 詳細/ })).toBeVisible(),
    );
  });

  it('詳細から戻っても一覧scroll位置を復元する', async () => {
    matchMedia(true);
    render(
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase}
        data={{
          ok: true,
          sponsors: [sponsor(), sponsor({ id: 2, name: '別のテスト店舗' })],
        }}
      />,
    );
    const list = screen.getByTestId('regional-sponsor-list-scroll');
    fireEvent.scroll(list, { target: { scrollTop: 120 } });
    fireEvent.click(
      screen.getByRole('button', { name: /テスト専用店舗.*詳細/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: '店舗一覧に戻る' }));
    await waitFor(() =>
      expect(screen.getByTestId('regional-sponsor-list-scroll').scrollTop).toBe(
        120,
      ),
    );
  });

  it('0件とCMS取得失敗を区別し、失敗時の再試行でrouter.refreshする', () => {
    matchMedia(true);
    const { rerender } = render(
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase} data={{ ok: true, sponsors: [] }} />,
    );
    expect(
      screen.getByText('掲載可能な地域協賛情報はありません。'),
    ).toBeInTheDocument();

    rerender(
      <RegionalSponsorMapScreen navigation={navigationItemsByPhase} data={{ ok: false, error: 'unavailable' }} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('取得できませんでした');
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.getByTestId('regional-map-view')).toBeInTheDocument();
  });
});
