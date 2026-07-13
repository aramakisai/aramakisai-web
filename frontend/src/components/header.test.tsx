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
    expect(screen.getByRole('link', { name: 'トップ' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'トピックス' })).toHaveAttribute(
      'href',
      '/topics',
    );
    expect(screen.getByRole('link', { name: '概要' })).toHaveAttribute(
      'href',
      '/about',
    );
  });
});
