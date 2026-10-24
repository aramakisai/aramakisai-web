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

  it('uses the final detail height while the sheet transition is still being measured', () => {
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

    expect(baseProps.onHeightChange).toHaveBeenCalledWith(700);
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
});
