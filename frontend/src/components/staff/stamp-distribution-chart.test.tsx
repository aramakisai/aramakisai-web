import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StampDistributionChart } from './stamp-distribution-chart';

const distribution = [
  { stampCount: 1, visitorCount: 5 },
  { stampCount: 2, visitorCount: 0 },
  { stampCount: 3, visitorCount: 2 },
];

describe('StampDistributionChart', () => {
  it('各棒が「N個 M台」のボタンで、初期は値の行を出さない', () => {
    render(<StampDistributionChart distribution={distribution} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: '2個 0台' })).toBeTruthy();
    expect(screen.queryByText('3個 2台')).toBeNull();
  });

  it('棒を押すと値の行を出し、もう一度押すと解除する', () => {
    render(<StampDistributionChart distribution={distribution} />);
    const bar = screen.getByRole('button', { name: '3個 2台' });
    fireEvent.click(bar);
    expect(screen.getByText('3個 2台')).toBeTruthy();
    expect(bar.getAttribute('aria-pressed')).toBe('true');
    expect(bar.firstElementChild?.className).toContain('bg-primary');
    fireEvent.click(bar);
    expect(screen.queryByText('3個 2台')).toBeNull();
    expect(bar.firstElementChild?.className).toContain('bg-accent-alt');
  });

  it('別の棒を押すと選択が移る', () => {
    render(<StampDistributionChart distribution={distribution} />);
    fireEvent.click(screen.getByRole('button', { name: '1個 5台' }));
    fireEvent.click(screen.getByRole('button', { name: '3個 2台' }));
    expect(screen.queryByText('1個 5台')).toBeNull();
    expect(screen.getByText('3個 2台')).toBeTruthy();
  });

  it('最大が 0 でも壊れない', () => {
    render(
      <StampDistributionChart
        distribution={[{ stampCount: 1, visitorCount: 0 }]}
      />,
    );
    expect(screen.getByRole('button', { name: '1個 0台' })).toBeTruthy();
  });
});
