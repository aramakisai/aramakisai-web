import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TouchParkingList } from './touch-parking-list';

describe('TouchParkingList', () => {
  it('取得時刻と2列のカードを出す', () => {
    const { container } = render(
      <TouchParkingList
        initial={{
          isEventDay: false,
          fetchedAt: '2026-10-24T04:42:00Z',
          lots: [
            { id: 1, name: 'A', status: null, updatedAt: null, image: null },
            { id: 2, name: 'B', status: null, updatedAt: null, image: null },
          ],
        }}
        renderedAt="2026-10-24T04:42:00Z"
      />,
    );
    expect(screen.getByText('13:42時点')).toBeInTheDocument();
    expect(container.querySelector('ul')).toHaveClass(
      'grid-cols-[924px_924px]',
      'gap-6',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('取得失敗時は取得できない旨を出す', () => {
    render(
      <TouchParkingList initial={null} renderedAt="2026-10-24T04:42:00Z" />,
    );
    expect(
      screen.getByText('駐車場の情報を取得できません'),
    ).toBeInTheDocument();
  });
});
