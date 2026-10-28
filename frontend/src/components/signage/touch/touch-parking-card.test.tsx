import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TouchParkingCard } from './touch-parking-card';

const NOW = new Date('2026-10-24T04:42:00Z');
const lot = (over = {}) => ({
  id: 1,
  name: '正門前駐車場',
  status: 'crowded' as const,
  updatedAt: '2026-10-24T04:40:00Z',
  image: null,
  ...over,
});

describe('TouchParkingCard', () => {
  it('名前・状態・更新時刻を出し、写真の場所を空ける', () => {
    const { container } = render(
      <TouchParkingCard lot={lot()} eventDay now={NOW} />,
    );
    expect(screen.getByText('正門前駐車場')).toHaveClass(
      'text-signage-heading',
    );
    const badge = screen.getByText('混雑');
    expect(badge.parentElement).toHaveClass('bg-primary');
    expect(screen.getByText('13:40更新')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveClass(
      'h-[246px]',
      'w-[924px]',
      'rounded-[16px]',
      'border-gray-200',
    );
    expect(
      container.querySelector('.h-\\[214px\\].w-\\[285px\\]'),
    ).not.toBeNull();
  });

  it('30分超で古い旨とアイコンを出す', () => {
    render(
      <TouchParkingCard
        lot={lot({ updatedAt: '2026-10-24T03:00:00Z' })}
        eventDay
        now={NOW}
      />,
    );
    expect(
      screen.getByText('12:00更新・情報が古い可能性があります'),
    ).toBeInTheDocument();
    expect(screen.getByText('history')).toHaveClass('text-warning');
  });

  it('未設定は更新時刻を出さない', () => {
    render(
      <TouchParkingCard
        lot={lot({ status: null, updatedAt: null })}
        eventDay
        now={NOW}
      />,
    );
    expect(screen.getByText('未設定')).toBeInTheDocument();
    expect(screen.queryByText(/更新/)).toBeNull();
  });

  it('画像ありは写真と撮影時刻を出す', () => {
    const { container } = render(
      <TouchParkingCard
        lot={lot({
          image: { url: '/p.jpg', capturedAt: '2026-10-24T04:35:00Z' },
        })}
        eventDay
        now={NOW}
      />,
    );
    const img = screen.getByAltText('正門前駐車場の現在の様子');
    expect(img).toHaveAttribute('src', '/p.jpg');
    expect(img).toHaveClass('rounded-[8px]', 'object-cover');
    expect(img.parentElement).toHaveClass('h-[214px]', 'w-[285px]');
    expect(screen.getByText('13:35撮影')).toHaveClass('text-gray-600');
    expect(container.querySelector('[class*="text-warning"]')).toBeNull();
  });

  it('15分以上前の画像は古い旨とアイコンを出す', () => {
    render(
      <TouchParkingCard
        lot={lot({
          image: { url: '/p.jpg', capturedAt: '2026-10-24T04:00:00Z' },
        })}
        eventDay
        now={NOW}
      />,
    );
    expect(
      screen.getByText('13:00撮影・古い画像の可能性があります'),
    ).toBeInTheDocument();
    expect(screen.getByText('history')).toHaveClass('text-warning');
  });

  it('空き状況が未設定なら画像があっても出さない', () => {
    render(
      <TouchParkingCard
        lot={lot({
          status: null,
          updatedAt: null,
          image: { url: '/p.jpg', capturedAt: '2026-10-24T04:35:00Z' },
        })}
        eventDay
        now={NOW}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/撮影/)).toBeNull();
  });

  it('当日でないときは非公開', () => {
    render(
      <TouchParkingCard
        lot={lot({ status: null, updatedAt: null })}
        eventDay={false}
        now={NOW}
      />,
    );
    expect(screen.getByText('非公開')).toBeInTheDocument();
  });
});
