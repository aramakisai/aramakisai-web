import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExhibitionMenu } from './exhibition-menu';

describe('ExhibitionMenu', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<ExhibitionMenu items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the heading and name/price rows in given order without header row', () => {
    render(
      <ExhibitionMenu
        items={[
          { name: '焼きそば', price: '¥400' },
          { name: 'ラムネ', price: '150円' },
        ]}
      />,
    );
    expect(screen.getByText('メニュー')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['焼きそば', '¥400']);
    expect(
      within(rows[1])
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['ラムネ', '150円']);
    expect(screen.queryByRole('columnheader')).toBeNull();
  });

  it('行間だけを空け、表の上下には余白を付けない', () => {
    render(<ExhibitionMenu items={[{ name: 'a', price: '1' }]} />);
    const table = screen.getByRole('table');
    expect(table).not.toHaveClass('border-separate');
    expect(table.className).toContain('[&_tr+tr>td]:pt-1');
  });
});
