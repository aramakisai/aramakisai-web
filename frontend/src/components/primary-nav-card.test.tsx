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
  { href: string; label: string; icon: string; color: string }
> = {
  exhibitions: {
    href: '/exhibitions',
    label: '企画一覧',
    icon: 'festival',
    color: 'primary',
  },
  map: { href: '/map', label: '構内マップ', icon: 'map', color: 'secondary' },
  timetable: {
    href: '/timetable',
    label: 'タイムテーブル',
    icon: 'calendar_clock',
    color: 'info',
  },
  parking: {
    href: '/parking',
    label: '駐車場空き情報',
    icon: 'parking_sign',
    color: 'accent',
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

  it.each(PRIMARY_NAV_DESTINATIONS)(
    'sizes the %s card 160x160 on PC / 171x171 on SP with a 12px radius, 2px border and background fill',
    (destination) => {
      const expected = EXPECTED[destination];
      render(<PrimaryNavCard destination={destination} />);

      const link = screen.getByRole('link', { name: expected.label });
      expect(link).toHaveClass(
        'w-[171px]',
        'h-[171px]',
        'lg:w-[160px]',
        'lg:h-[160px]',
        'rounded-xl',
        'border-2',
        'bg-white',
        'hover-card-shadow',
      );
      expect(link.style.backgroundImage).toBe('');
    },
  );

  it.each(PRIMARY_NAV_DESTINATIONS)(
    'sizes the %s icon 72px on PC / 64px on SP',
    (destination) => {
      const expected = EXPECTED[destination];
      render(<PrimaryNavCard destination={destination} />);

      expect(
        screen.getByTestId(`icon-${expected.icon.replace(/_/g, '-')}`),
      ).toHaveClass('text-[64px]!', 'lg:text-[72px]!');
    },
  );

  it.each(PRIMARY_NAV_DESTINATIONS)(
    'colors the %s border and icon with the same token',
    (destination) => {
      const expected = EXPECTED[destination];
      render(<PrimaryNavCard destination={destination} />);

      const link = screen.getByRole('link', { name: expected.label });
      const icon = screen.getByTestId(
        `icon-${expected.icon.replace(/_/g, '-')}`,
      );
      expect(link).toHaveClass(`border-${expected.color}`);
      expect(icon).toHaveClass(`text-${expected.color}`);
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
      'lg:flex',
      'lg:justify-center',
      'lg:gap-10',
    );
  });
});
