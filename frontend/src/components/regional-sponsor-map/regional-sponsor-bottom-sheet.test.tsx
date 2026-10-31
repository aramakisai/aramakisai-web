import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

const mocks = vi.hoisted(() => ({
  sheetProps: null as null | Record<string, unknown>,
}));

vi.mock('@/components/map/map-bottom-sheet', () => ({
  MapBottomSheet: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    mocks.sheetProps = props;
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
};

const baseProps = {
  sponsors: [sponsor],
  selectedSponsor: null,
  listScrollTop: 0,
  locationSponsors: null,
  locationListScrollTop: 0,
  onScrollTopChange: vi.fn(),
  onLocationScrollTopChange: vi.fn(),
  onLocationBack: vi.fn(),
  onSelect: vi.fn(),
  onBack: vi.fn(),
};

beforeEach(() => {
  mocks.sheetProps = null;
});

describe('RegionalSponsorBottomSheet', () => {
  it('一覧を共通のシートに載せ、選択がなければ引き上げの対象を渡さない', () => {
    render(<RegionalSponsorBottomSheet {...baseProps} />);
    expect(screen.getByText('list')).toBeInTheDocument();
    expect(mocks.sheetProps).toMatchObject({
      collapsed: false,
      selectedKey: null,
    });
  });

  it('店舗を選ぶと詳細を描画し、選択中の店舗 ID を共通のシートへ渡す', () => {
    render(
      <RegionalSponsorBottomSheet {...baseProps} selectedSponsor={sponsor} />,
    );
    expect(screen.getByText('detail')).toBeInTheDocument();
    expect(mocks.sheetProps).toMatchObject({ selectedKey: 1 });
  });

  it('地点の一覧は選択がなければ地点の一覧を描画する', () => {
    render(
      <RegionalSponsorBottomSheet
        {...baseProps}
        locationSponsors={[sponsor]}
      />,
    );
    expect(screen.getByText('location-list')).toBeInTheDocument();
  });

  it('エラーは内容高へ縮める', () => {
    render(<RegionalSponsorBottomSheet {...baseProps} error />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mocks.sheetProps).toMatchObject({ collapsed: true });
  });
});
