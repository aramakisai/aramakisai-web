import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { Header, navigationItems } from './header';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

describe('Header', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/');
  });

  test('exposes the navigation definition with only existing routes', () => {
    expect(navigationItems.map((item) => item.href)).toEqual([
      '/',
      '/#about',
      '/announcements',
    ]);
    expect(
      navigationItems.find((item) => item.href === '/#about')?.children,
    ).toEqual([
      { label: '概要', href: '/#about-overview' },
      { label: '開催スケジュール', href: '/#about-schedule' },
      { label: '今年のテーマ', href: '/#about-theme' },
    ]);
  });

  test('renders the 2026 logo and all desktop navigation links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: '荒牧祭2026' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('img', { name: '荒牧祭2026' })).toHaveAttribute(
      'src',
      '/images/logo-2026.png',
    );
    expect(screen.getByRole('link', { name: 'TOP' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('link', { name: '荒牧祭について' }),
    ).toHaveAttribute('href', '/#about');
    expect(screen.getByRole('link', { name: 'お知らせ' })).toHaveAttribute(
      'href',
      '/announcements',
    );
    expect(
      screen.queryByRole('link', { name: '企画を探す' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '会場案内' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '協賛企業' }),
    ).not.toBeInTheDocument();
  });

  test.each([
    ['/', 'TOP'],
    ['/announcements/7', 'お知らせ'],
  ])('marks the current section for %s', (pathname, label) => {
    mockedUsePathname.mockReturnValue(pathname);

    render(<Header />);

    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('keeps TOP as the current page for the in-page about link', () => {
    mockedUsePathname.mockReturnValue('/');

    render(<Header />);

    expect(screen.getByRole('link', { name: 'TOP' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: '荒牧祭について' }),
    ).not.toHaveAttribute('aria-current');
  });

  test('provides keyboard-accessible in-page links in the about dropdown', () => {
    render(<Header />);

    const aboutLink = screen.getByRole('link', { name: '荒牧祭について' });
    expect(aboutLink).toHaveAttribute('href', '/#about');

    const submenu = screen.getByRole('list', {
      name: '荒牧祭についてのサブメニュー',
    });
    const submenuContainer = submenu.parentElement;
    expect(submenuContainer).toHaveClass(
      'opacity-0',
      'pointer-events-none',
      'group-hover/about:opacity-100',
      'group-hover/about:pointer-events-auto',
      'group-focus-within/about:opacity-100',
      'group-focus-within/about:pointer-events-auto',
    );

    const submenuLinks = within(submenu).getAllByRole('link');
    expect(
      submenuLinks.map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['概要', '/#about-overview'],
      ['開催スケジュール', '/#about-schedule'],
      ['今年のテーマ', '/#about-theme'],
    ]);

    aboutLink.focus();
    expect(aboutLink).toHaveFocus();
    submenuLinks.forEach((link) => {
      link.focus();
      expect(link).toHaveFocus();
    });
  });

  test('reuses the Mansai hover line in the main navigation and dropdown', () => {
    const { container } = render(<Header />);

    const lines = container.querySelectorAll('.mansai-spectrum-line');
    expect(lines).toHaveLength(6);

    const submenu = screen.getByRole('list', {
      name: '荒牧祭についてのサブメニュー',
    });
    within(submenu)
      .getAllByRole('link')
      .forEach((link) => {
        expect(link.querySelector('.mansai-spectrum-line')).toHaveClass(
          'h-px',
          'scale-x-0',
          'transition-all',
        );
      });
  });

  test('opens a mobile navigation with the three main links', () => {
    render(<Header />);

    const menuButton = screen.getByRole('button', {
      name: 'メニューを開く',
    });
    expect(menuButton).toHaveAttribute('type', 'button');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'mobile-navigation');
    expect(menuButton).toHaveClass('h-11', 'w-11', 'lg:hidden');
    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();

    fireEvent.click(menuButton);

    expect(
      screen.getByRole('button', { name: 'メニューを閉じる' }),
    ).toHaveAttribute('aria-expanded', 'true');
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'モバイルナビゲーション',
    });
    expect(mobileNavigation).toHaveClass(
      'lg:hidden',
      'w-full',
      'min-w-0',
      'overflow-y-auto',
    );
    expect(
      within(mobileNavigation)
        .getAllByRole('link', { hidden: false })
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['TOP', '/'],
      ['荒牧祭について', '/#about'],
      ['お知らせ', '/announcements'],
    ]);
  });

  test('expands the mobile about submenu by tap and closes after navigation', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    const mobileNavigation = screen.getByRole('navigation', {
      name: 'モバイルナビゲーション',
    });
    const aboutToggle = within(mobileNavigation).getByRole('button', {
      name: '荒牧祭についてのサブメニューを開く',
    });
    expect(aboutToggle).toHaveAttribute('aria-expanded', 'false');
    expect(aboutToggle).toHaveAttribute(
      'aria-controls',
      'mobile-about-submenu',
    );
    expect(aboutToggle).toHaveClass('h-11', 'w-11');

    fireEvent.click(aboutToggle);

    expect(
      within(mobileNavigation).getByRole('button', {
        name: '荒牧祭についてのサブメニューを閉じる',
      }),
    ).toHaveAttribute('aria-expanded', 'true');
    const submenu = within(mobileNavigation).getByRole('list', {
      name: '荒牧祭についてのモバイルサブメニュー',
    });
    expect(
      within(submenu)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['概要', '/#about-overview'],
      ['開催スケジュール', '/#about-schedule'],
      ['今年のテーマ', '/#about-theme'],
    ]);
    within(submenu)
      .getAllByRole('link')
      .forEach((link) => expect(link).toHaveClass('min-h-11'));

    fireEvent.click(within(submenu).getByRole('link', { name: '概要' }));
    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();
  });

  test('closes the mobile menu with Escape and returns focus to the toggle', () => {
    render(<Header />);

    const menuButton = screen.getByRole('button', {
      name: 'メニューを開く',
    });
    fireEvent.click(menuButton);
    expect(
      screen.getByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  test('uses compact mobile sizing and safe-area spacing without changing desktop sizes', () => {
    const { container } = render(<Header />);

    const header = container.querySelector('header');
    expect(header).toHaveClass('pt-[env(safe-area-inset-top)]');
    const headerInner = header?.firstElementChild;
    expect(headerInner).toHaveClass('h-16', 'lg:h-20');
    expect(screen.getByRole('img', { name: '荒牧祭2026' })).toHaveClass(
      'h-8',
      'lg:h-9',
      'xl:h-10',
    );
    expect(
      container.querySelector('[aria-hidden="true"].header-spacer'),
    ).toHaveClass(
      'h-[calc(4rem+env(safe-area-inset-top))]',
      'lg:h-[calc(5rem+env(safe-area-inset-top))]',
    );
  });
});
