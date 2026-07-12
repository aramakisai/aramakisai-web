import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { Footer } from './footer';

describe('Footer', () => {
  test('renders nav links to contact, access, privacy', () => {
    render(<Footer />);

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
});
