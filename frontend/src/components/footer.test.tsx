import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { Footer } from './footer';
import { getSnsLinks } from '../lib/sns-links';

vi.mock('../lib/sns-links', () => ({
  getSnsLinks: vi.fn(),
}));

describe('Footer', () => {
  test('renders nav links to contact, access, privacy', async () => {
    vi.mocked(getSnsLinks).mockResolvedValue([]);
    const jsx = await Footer();
    render(jsx);

    expect(screen.getByRole('link', { name: 'お問い合わせ' })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'アクセス' })).toHaveAttribute(
      'href',
      '/access',
    );
    expect(
      screen.getByRole('link', { name: 'プライバシーポリシー' }),
    ).toHaveAttribute('href', '/privacy');
  });

  test('does not render SNS links when sns_links is empty', async () => {
    vi.mocked(getSnsLinks).mockResolvedValue([]);
    const jsx = await Footer();
    render(jsx);

    const links = screen.queryAllByRole('link');
    // Ensure only the 3 main links exist
    expect(links).toHaveLength(3);
  });

  test('renders SNS links with aria-label when sns_links has items', async () => {
    vi.mocked(getSnsLinks).mockResolvedValue([
      { platform: 'x', url: 'https://x.com/example' },
      { platform: 'instagram', url: 'https://instagram.com/example' },
    ]);
    const jsx = await Footer();
    render(jsx);

    expect(screen.getByRole('link', { name: 'x' })).toHaveAttribute(
      'href',
      'https://x.com/example',
    );
    expect(screen.getByRole('link', { name: 'instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/example',
    );

    // Also still renders the 3 main links
    expect(
      screen.getByRole('link', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();
  });

  test('renders successfully even if getSnsLinks throws an error', async () => {
    vi.mocked(getSnsLinks).mockRejectedValue(new Error('Fetch failed'));
    const jsx = await Footer();
    render(jsx);

    expect(
      screen.getByRole('link', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();

    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(3); // Only the 3 main links exist
  });
});
