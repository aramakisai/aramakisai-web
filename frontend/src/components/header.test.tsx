import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { Header } from './header';

describe('Header', () => {
  test('renders site title link and nav links', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: '荒牧祭' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('link', { name: 'お問い合わせ' }),
    ).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'アクセス' })).toHaveAttribute(
      'href',
      '/access',
    );
  });
});
