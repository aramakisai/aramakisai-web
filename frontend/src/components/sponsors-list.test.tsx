import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { SponsorsList } from './sponsors-list';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import type { SponsorListItem } from '@/lib/sponsors';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

const ad = (id: number, tier: string, logo: string | null = `f${id}`) =>
  ({ id, name: `Ad ${id}`, logoId: logo, url: null, tier }) as SponsorListItem;

const local = (id: number, over: Partial<RegionalSponsor> = {}) =>
  ({
    id,
    name: `Local ${id}`,
    category: 'food',
    latitude: 0,
    longitude: 0,
    address: `Addr ${id}`,
    imageId: null,
    imageAlt: null,
    imageDecorative: true,
    message: `Msg ${id}`,
    businessHours: null,
    phone: null,
    websiteUrl: null,
    ...over,
  }) as RegionalSponsor;

describe('SponsorsList', () => {
  test('見出し・小見出しと2つの導線を常に表示する', () => {
    render(<SponsorsList adSponsors={[]} localSponsors={[]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: '協賛' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: '広告協賛' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: '地域協賛' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /広告協賛へ/ })).toHaveAttribute(
      'href',
      '/sponsors/ad',
    );
    expect(screen.getByRole('link', { name: /地域協賛へ/ })).toHaveAttribute(
      'href',
      '/sponsors/local',
    );
  });

  test('0件では帯もカードも出さない', () => {
    render(<SponsorsList adSponsors={[]} localSponsors={[]} />);

    expect(
      screen.queryByTestId('ad-sponsor-marquee-track'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  test('広告協賛は帯に並び、ロゴは画像・ロゴ無しは社名で出す。2つ目のセットは読み上げ対象外', () => {
    render(
      <SponsorsList
        adSponsors={[
          ad(1, 'planA'),
          ad(2, 'planA', null),
          ad(3, 'planD', null),
        ]}
        localSponsors={[]}
      />,
    );

    // A は PC 用グリッドと帯 (SP 用) の両方に入る。表示の出し分けは CSS
    expect(screen.getAllByAltText('Ad 1')).toHaveLength(2);
    expect(screen.getAllByText('Ad 2')).toHaveLength(3);
    expect(screen.getAllByText('Ad 3')).toHaveLength(2);
    const track = screen.getByTestId('ad-sponsor-marquee-track');
    expect(track.children).toHaveLength(2);
    expect(track.children[1]).toHaveAttribute('aria-hidden', 'true');
  });

  test('地域協賛は5件以上あっても4件に絞る', () => {
    render(
      <SponsorsList
        adSponsors={[]}
        localSponsors={[1, 2, 3, 4, 5].map((i) => local(i))}
      />,
    );

    expect(screen.getAllByText(/^Local \d$/)).toHaveLength(4);
    expect(screen.getAllByText('飲食')).toHaveLength(4);
  });

  test('住所・説明が空ならその行を出さない', () => {
    render(
      <SponsorsList
        adSponsors={[]}
        localSponsors={[local(1, { address: null, message: null })]}
      />,
    );

    expect(screen.queryByText('location_on')).not.toBeInTheDocument();
    expect(screen.queryByText('chat_bubble')).not.toBeInTheDocument();
  });
});
