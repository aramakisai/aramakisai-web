import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Footer } from './footer';
import * as snsLinksModule from '@/lib/sns-links';

vi.mock('@/lib/sns-links', () => ({
  getSnsLinks: vi.fn(),
}));

const contactFormUrl =
  'https://docs.google.com/forms/d/e/1FAIpQLSdfNRBPktNU8u_YTWarZUiIW-rhusE9hG_7dqyQHKEq4Vxlpg/viewform?usp=sharing&ouid=103248927242052693439';

describe('Footer', () => {
  async function renderFooter() {
    return render(await Footer());
  }

  test('renders the site navigation and support links using only existing routes', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([]);
    await renderFooter();

    const footer = screen.getByRole('contentinfo');
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
      ['お知らせ', '/announcements'],
    ]);

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

    expect(
      screen.queryByRole('link', { name: '企画を探す' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '会場案内' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '協賛企業' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'お知らせ' })).toHaveAttribute(
      'href',
      '/announcements',
    );
  });

  test('restores the committee address and contact email removed by nightly', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([]);
    await renderFooter();

    expect(screen.getByText(/〒371-8510/)).toBeInTheDocument();
    expect(
      screen.getByText(/群馬県前橋市荒牧町4-2/),
    ).toBeInTheDocument();
    expect(screen.getByText(/mail_at_example\.invalid/)).toBeInTheDocument();
  });

  test('renders SNS links from getSnsLinks() with accessible icons', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
      { platform: 'Instagram', url: 'https://www.instagram.com/aramakisai_/' },
    ]);
    await renderFooter();

    expect(screen.getByText('OFFICIAL SNS')).toBeInTheDocument();

    const xLink = screen.getByRole('link', { name: '荒牧祭公式X' });
    expect(xLink).toHaveAttribute('href', 'https://x.com/aramakisai_');
    expect(xLink).toHaveAttribute('target', '_blank');
    expect(xLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(xLink).getByTestId('icon-x')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    const instagramLink = screen.getByRole('link', {
      name: '荒牧祭公式Instagram',
    });
    expect(instagramLink).toHaveAttribute(
      'href',
      'https://www.instagram.com/aramakisai_/',
    );
  });

  test('hides the SNS block but keeps the rest of the footer when getSnsLinks() fails', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockRejectedValue(
      new Error('Directus Error'),
    );
    await renderFooter();

    expect(screen.queryByText('OFFICIAL SNS')).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'フッターサイト案内' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/〒371-8510/)).toBeInTheDocument();
  });

  test('hides the SNS block entirely when there are no links', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([]);
    await renderFooter();

    expect(screen.queryByText('OFFICIAL SNS')).not.toBeInTheDocument();
  });

  test('uses the shared Mansai hover line styling and copyright', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
    ]);
    const { container } = await renderFooter();

    const hoverLines = container.querySelectorAll('.mansai-spectrum-line');
    expect(hoverLines.length).toBeGreaterThan(0);
    hoverLines.forEach((line) =>
      expect(line).toHaveClass('h-px', 'scale-x-0', 'transition-transform'),
    );

    expect(screen.getByText('© 2026 群馬大学荒牧祭実行委員会')).toBeInTheDocument();
  });
});
