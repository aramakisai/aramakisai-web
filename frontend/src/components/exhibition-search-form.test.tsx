import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExhibitionSearchForm } from './exhibition-search-form';

describe('ExhibitionSearchForm', () => {
  it('submits as a GET to /exhibitions with the keyword as q', () => {
    render(<ExhibitionSearchForm />);

    const form = screen.getByRole('search');
    expect(form.tagName).toBe('FORM');
    expect(form).toHaveAttribute('action', '/exhibitions');
    expect(form).toHaveAttribute('method', 'get');

    const input = screen.getByPlaceholderText('企画名・団体名で検索');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveAttribute('type', 'search');
  });
});
