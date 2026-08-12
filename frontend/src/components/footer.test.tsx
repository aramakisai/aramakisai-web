import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Footer } from './footer';

const contactFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSdfNRBPktNU8u_YTWarZUiIW-rhusE9hG_7dqyQHKEq4Vxlpg/viewform?usp=sharing&ouid=103248927242052693439';

describe('Footer', () => {
  function renderFooter() {
    return render(<Footer />);
  }

  test('renders the requested site navigation and support links', () => {
    renderFooter();

    const footer = screen.getByRole('contentinfo');
    expect(footer).not.toHaveClass('fixed');
    expect(footer).not.toHaveClass('sticky');
    expect(footer).not.toHaveClass('absolute');
    expect(footer).toHaveClass('border-t', 'bg-slate-50/70');

    const siteNavigation = screen.getByRole('navigation', {
      name: 'フッターサイト案内',
    });
    expect(
      within(siteNavigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['TOP', '/'],
      ['荒牧祭について', '/#about'],
      ['企画を探す', '/events'],
      ['会場案内', '/guide'],
      ['協賛企業', '/sponsors'],
      ['お知らせ', '/news'],
    ]);

    const contact = screen.getByRole('link', { name: 'お問い合わせ' });
    expect(contact).toHaveAttribute('href', contactFormUrl);
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer');

    const supportNavigation = screen.getByRole('navigation', {
      name: 'フッターサポート',
    });
    expect(
      within(supportNavigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['お問い合わせ', contactFormUrl],
      ['プライバシーポリシー', '/privacy-policy'],
    ]);

    const privacyPolicy = within(supportNavigation).getByRole('link', {
      name: 'プライバシーポリシー',
    });
    expect(privacyPolicy).not.toHaveAttribute('target');

    expect(screen.queryByText(/E-mail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/電話/)).not.toBeInTheDocument();
    expect(screen.queryByText(/〒371-8510/)).not.toBeInTheDocument();
    expect(screen.queryByText(/群馬県前橋市荒牧町4-2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/_at_/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FAQ/i)).not.toBeInTheDocument();
  });

  test('renders the three official SNS links with accessible icons', () => {
    renderFooter();

    expect(screen.getByText('OFFICIAL SNS')).toBeInTheDocument();

    const socialLinks = [
      ['荒牧祭公式X', 'https://x.com/aramakisai_', 'icon-x'],
      [
        '荒牧祭公式Instagram',
        'https://www.instagram.com/aramakisai_/',
        'icon-instagram',
      ],
      [
        '荒牧祭公式YouTube',
        'https://www.youtube.com/@aramakisai',
        'icon-youtube',
      ],
    ] as const;

    socialLinks.forEach(([label, href, iconTestId]) => {
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveClass('min-h-11', 'min-w-11');
      expect(within(link).getByTestId(iconTestId)).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    expect(
      screen.queryByRole('link', { name: /Facebook|LINE|TikTok/i }),
    ).not.toBeInTheDocument();
  });

  test('uses the shared Mansai hover line and responsive layout', () => {
    const { container } = renderFooter();

    const footerLayout = screen.getByTestId('footer-layout');
    expect(footerLayout).toHaveClass(
      'grid-cols-1',
      'lg:grid-cols-[minmax(0,1fr)_auto]',
    );

    const columns = screen.getByTestId('footer-columns');
    expect(columns).toHaveClass('grid-cols-1', 'sm:grid-cols-2');

    const hoverLines = container.querySelectorAll('.mansai-spectrum-line');
    expect(hoverLines).toHaveLength(11);
    hoverLines.forEach((line) =>
      expect(line).toHaveClass(
        'h-px',
        'scale-x-0',
        'transition-transform',
        'group-hover:scale-x-100',
        'group-focus-visible:scale-x-100',
        'motion-reduce:transition-none',
      ),
    );

    expect(screen.getByText('© 2026 群馬大学荒牧祭実行委員会')).toHaveClass(
      'text-xs',
    );

    const copyright = screen
      .getByText('© 2026 群馬大学荒牧祭実行委員会')
      .closest('div');
    expect(copyright).toHaveClass(
      'pt-6',
      'pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
    );
  });
});
