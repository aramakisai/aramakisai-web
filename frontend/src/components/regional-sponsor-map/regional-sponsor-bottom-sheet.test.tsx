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
  RegionalSponsorList: () => <div>list</div>,
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
  closedDays: null,
  phone: null,
  websiteUrl: null,
  order: 0,
};

const baseProps = {
  sponsors: [sponsor],
  snap: 'list' as const,
  listScrollTop: 0,
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
      }) => number;
    }[];
    for (const viewportHeight of [390, 600, 844]) {
      for (const id of ['detail', 'expanded']) {
        const height = snaps
          .find((snap) => snap.id === id)!
          .resolveHeightPx({ viewportHeight, contentHeight: 0 });
        expect(viewportHeight - height).toBeGreaterThanOrEqual(
          Math.min(278, viewportHeight - 112),
        );
      }
    }
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
});
