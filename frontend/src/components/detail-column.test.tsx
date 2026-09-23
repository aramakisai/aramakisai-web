import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BackLink, DetailColumn } from './detail-column';

describe('BackLink', () => {
  it('renders a link with the given href and label', () => {
    render(<BackLink href="/announcements" label="お知らせ一覧に戻る" />);

    const link = screen.getByRole('link', { name: 'お知らせ一覧に戻る' });
    expect(link).toHaveAttribute('href', '/announcements');
  });
});

describe('DetailColumn', () => {
  it('wraps children in the shared column frame', () => {
    render(
      <DetailColumn>
        <p>子要素</p>
      </DetailColumn>,
    );

    expect(screen.getByText('子要素')).toBeInTheDocument();
  });
});
