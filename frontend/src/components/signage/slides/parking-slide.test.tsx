import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ParkingSlide } from './parking-slide';

const lot = (
  id: number,
  name: string,
  status: 'available' | 'full' | null,
) => ({
  id,
  name,
  status,
  updatedAt: status ? '2026-11-14T05:05:00Z' : null,
});

test('状態が未設定の駐車場は出さず、設定済みは文字ラベルと更新時刻を出す', () => {
  render(
    <ParkingSlide
      parking={{
        isEventDay: true,
        fetchedAt: '2026-11-14T05:10:00Z',
        lots: [
          lot(1, 'P5', 'available'),
          lot(2, 'P7', null),
          lot(3, 'P8', 'full'),
        ],
      }}
    />,
  );
  expect(screen.getByText('P5')).toBeInTheDocument();
  expect(screen.getByText('P8')).toBeInTheDocument();
  expect(screen.queryByText('P7')).not.toBeInTheDocument();
  expect(screen.getByText('空き')).toHaveClass('bg-success');
  expect(screen.getByText('満車')).toHaveClass('bg-warning');
  expect(screen.getAllByText('14:05更新')).toHaveLength(2);
});
