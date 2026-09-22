import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PrimaryNavCard,
  PrimaryNavGrid,
  PRIMARY_NAV_DESTINATIONS,
  type PrimaryNavDestination,
} from './primary-nav-card';

const EXPECTED: Record<
  PrimaryNavDestination,
  { href: string; label: string; icon: string }
> = {
  exhibitions: { href: '/exhibitions', label: '企画一覧', icon: 'festival' },
  map: { href: '/map', label: '構内マップ', icon: 'map' },
  timetable: {
    href: '/timetable',
    label: 'タイムテーブル',
    icon: 'calendar_clock',
  },
  parking: {
    href: '/parking',
    label: '駐車場空き情報',
    icon: 'parking_sign',
  },
};

describe('PrimaryNavCard', () => {
  it('lists all 4 destinations', () => {
    expect(PRIMARY_NAV_DESTINATIONS).toEqual([
      'exhibitions',
      'map',
      'timetable',
      'parking',
    ]);
  });

  it.each(PRIMARY_NAV_DESTINATIONS)(
    'renders the %s destination link, label and icon',
    (destination) => {
      const expected = EXPECTED[destination];
      render(<PrimaryNavCard destination={destination} />);

      const link = screen.getByRole('link', { name: expected.label });
      expect(link).toHaveAttribute('href', expected.href);
      expect(
        screen.getByTestId(`icon-${expected.icon.replace(/_/g, '-')}`),
      ).toBeInTheDocument();
    },
  );
});

describe('PrimaryNavGrid', () => {
  it('renders all 4 destinations as a 2 columns (SP) / 4 columns (PC) grid', () => {
    const { container } = render(<PrimaryNavGrid />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/exhibitions',
      '/map',
      '/timetable',
      '/parking',
    ]);

    expect(container.firstChild).toHaveClass(
      'grid',
      'grid-cols-2',
      'gap-4',
      'lg:grid-cols-4',
      'lg:gap-6',
    );
  });
});
