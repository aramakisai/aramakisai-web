import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Page from './page';

describe('Page', () => {
  it('荒牧祭 見出しを表示する', () => {
    render(<Page />);
    expect(screen.getByRole('main')).toHaveTextContent('荒牧祭');
  });
});
