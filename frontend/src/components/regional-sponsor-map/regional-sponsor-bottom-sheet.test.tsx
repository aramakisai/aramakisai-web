import type { ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

const mocks = vi.hoisted(() => ({
  shellProps: null as null | Record<string, unknown>,
}));

vi.mock('@/components/map/map-bottom-sheet-shell', () => ({
  MapBottomSheetShell: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    mocks.shellProps = props;
    return <div>{children}</div>;
  },
}));

vi.mock('./regional-sponsor-detail', () => ({
  RegionalSponsorDetail: () => <div>detail</div>,
}));

vi.mock('./regional-sponsor-list', () => ({
  RegionalSponsorList: ({
    onLocationBack,
  }: {
    onLocationBack?: () => void;
  }) => <div>{onLocationBack ? 'location-list' : 'list'}</div>,
}));

import { RegionalSponsorBottomSheet } from './regional-sponsor-bottom-sheet';

const sponsor: RegionalSponsor = {
  id: 1,
  name: 'テスト店舗',
  category: 'shop',
  latitude: 36.43,
  longitude: 139.04,
  address: '群馬県前橋市',
  imageId: null,
  imageAlt: null,
  imageDecorative: false,
  message: null,
  businessHours: null,
  phone: null,
  websiteUrl: null,
  order: 0,
};

const baseProps = {
  sponsors: [sponsor],
  snap: 'list' as const,
  listScrollTop: 0,
  locationSponsors: null,
  locationListScrollTop: 0,
  onLocationScrollTopChange: vi.fn(),
  onLocationBack: vi.fn(),
  onRetry: vi.fn(),
  onSnapChange: vi.fn(),
  onHeightChange: vi.fn(),
  onScrollTopChange: vi.fn(),
  onSelect: vi.fn(),
  onBack: vi.fn(),
};

describe('RegionalSponsorBottomSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shellProps = null;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 844,
    });
  });

  it('reports the measured height unchanged while showing the detail', () => {
    render(
      <RegionalSponsorBottomSheet
        {...baseProps}
        selectedSponsor={sponsor}
        snap="detail"
      />,
    );

    act(() => {
      (mocks.shellProps?.onHeightChange as (height: number) => void)(380);
    });

    expect(baseProps.onHeightChange).toHaveBeenCalledWith(380);
  });

  it('reports the measured height unchanged while showing the list', () => {
    render(
      <RegionalSponsorBottomSheet {...baseProps} selectedSponsor={null} />,
    );

    act(() => {
      (mocks.shellProps?.onHeightChange as (height: number) => void)(380);
    });

    expect(baseProps.onHeightChange).toHaveBeenCalledWith(380);
  });

  it('does not expose the detail snap until a sponsor is selected', () => {
    const { rerender } = render(
      <RegionalSponsorBottomSheet {...baseProps} selectedSponsor={null} />,
    );

    expect(
      (mocks.shellProps?.snaps as { id: string }[]).map(({ id }) => id),
    ).toEqual(['collapsed', 'list', 'expanded']);

    rerender(
      <RegionalSponsorBottomSheet
        {...baseProps}
        selectedSponsor={sponsor}
        snap="detail"
      />,
    );
    expect(
      (mocks.shellProps?.snaps as { id: string }[]).map(({ id }) => id),
    ).toEqual(['collapsed', 'list', 'detail', 'expanded']);

    const snaps = mocks.shellProps?.snaps as {
      id: string;
      resolveHeightPx: (context: {
        viewportHeight: number;
        contentHeight: number;
        bottomInset: number;
      }) => number;
    }[];
    for (const viewportHeight of [390, 600, 844]) {
      for (const id of ['detail']) {
        const height = snaps
          .find((snap) => snap.id === id)!
          .resolveHeightPx({
            viewportHeight,
            contentHeight: 0,
            bottomInset: 0,
          });
        expect(viewportHeight - height).toBeGreaterThanOrEqual(
          Math.min(278, viewportHeight - 112),
        );
      }
    }
  });

  it('places the expanded sheet top 8px below the search overlay', () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-regional-search-overlay', '');
    overlay.getBoundingClientRect = () => ({ bottom: 106 }) as DOMRect;
    document.body.append(overlay);

    render(
      <RegionalSponsorBottomSheet {...baseProps} selectedSponsor={null} />,
    );
    overlay.remove();

    const expanded = (
      mocks.shellProps?.snaps as {
        id: string;
        resolveHeightPx: (context: {
          viewportHeight: number;
          contentHeight: number;
          bottomInset: number;
        }) => number;
      }[]
    ).find(({ id }) => id === 'expanded')!;
    expect(
      expanded.resolveHeightPx({
        viewportHeight: 844,
        contentHeight: 0,
        bottomInset: 0,
      }),
    ).toBe(844 - 114);
    // 下部ナビ(80px)の上に置くので、上端位置は変えず高さだけ縮む
    expect(
      expanded.resolveHeightPx({
        viewportHeight: 844,
        contentHeight: 0,
        bottomInset: 80,
      }),
    ).toBe(844 - 114 - 80);
  });

  it('keeps the visible back operation active when detail is collapsed', () => {
    render(
      <RegionalSponsorBottomSheet
        {...baseProps}
        selectedSponsor={sponsor}
        snap="collapsed"
      />,
    );

    const collapsed = (
      mocks.shellProps?.snaps as { id: string; contentInert?: boolean }[]
    ).find(({ id }) => id === 'collapsed');
    expect(collapsed?.contentInert).toBe(false);
  });

  it('地点の一覧は一覧と同じsnap構成で、詳細を選んでいなければ地点の一覧を描画する', () => {
    const { getByText } = render(
      <RegionalSponsorBottomSheet
        {...baseProps}
        selectedSponsor={null}
        locationSponsors={[sponsor]}
      />,
    );
    expect(getByText('location-list')).toBeInTheDocument();
    expect(
      (mocks.shellProps?.snaps as { id: string }[]).map(({ id }) => id),
    ).toEqual(['collapsed', 'list', 'expanded']);
  });
});
