import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('NotFound', () => {
  it('404見出しとトップページへのリンクが表示される', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'トップページに戻る' }),
    ).toHaveAttribute('href', '/');
  });
});
