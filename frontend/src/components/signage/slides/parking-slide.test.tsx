import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ParkingImage } from '@/lib/parking';
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
  image: null as ParkingImage | null,
});

test('状態が未設定の駐車場は出さず、設定済みは文字ラベルと更新時刻を出す', () => {
  render(
    <ParkingSlide
      now={new Date(0)}
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
  expect(screen.getAllByText('14:05 更新')).toHaveLength(2);
});

const NOW = new Date('2026-11-14T05:10:00Z');
const img = (capturedAt: string) => ({
  url: 'https://cms.example/p.webp',
  capturedAt,
  width: 960,
  height: 720,
});
const withImage = (
  id: number,
  name: string,
  capturedAt: string | null,
): ReturnType<typeof lot> => ({
  ...lot(id, name, 'available'),
  image: capturedAt ? img(capturedAt) : null,
});
const renderLots = (lots: ReturnType<typeof lot>[]) =>
  render(
    <ParkingSlide
      now={NOW}
      parking={{
        isEventDay: true,
        fetchedAt: '2026-11-14T05:10:00Z',
        lots,
      }}
    />,
  );

test('画像ありは右列に312x234の画像と「撮影」を出し、画像なしは右列を出さない', () => {
  const { container } = renderLots([
    withImage(1, 'P5', '2026-11-14T05:05:00Z'),
    withImage(2, 'P8', null),
  ]);
  const imgs = container.querySelectorAll('img');
  expect(imgs).toHaveLength(1);
  expect(imgs[0]).toHaveAttribute('src', 'https://cms.example/p.webp');
  expect(imgs[0].parentElement).toHaveClass('h-[234px]', 'w-[312px]');
  expect(screen.getAllByText('14:05 撮影')).toHaveLength(1);
  expect(screen.getAllByText('14:05 更新')).toHaveLength(2);
});

test('画像ありのカードは高さ356、同じ行の画像なしも揃う', () => {
  renderLots([
    withImage(1, 'P5', '2026-11-14T05:05:00Z'),
    withImage(2, 'P8', null),
  ]);
  for (const name of ['P5', 'P8']) {
    expect(screen.getByText(name).closest('li')).toHaveClass('min-h-[356px]');
  }
});

test('1行目が全部画像なしでも、2行目に画像ありがあれば4枚とも高さ356', () => {
  renderLots([
    withImage(1, 'P1', null),
    withImage(2, 'P2', null),
    withImage(3, 'P3', null),
    withImage(4, 'P4', '2026-11-14T05:05:00Z'),
  ]);
  for (const name of ['P1', 'P2', 'P3', 'P4']) {
    expect(screen.getByText(name).closest('li')).toHaveClass('min-h-[356px]');
  }
});

test('すべて画像なしなら高さ250のカードで、縦中央寄せの枠に入る', () => {
  const { container } = renderLots([
    withImage(1, 'P5', null),
    withImage(2, 'P7', null),
  ]);
  expect(screen.getByText('P5').closest('li')).toHaveClass('min-h-[250px]');
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('P5').closest('ul')?.parentElement).toHaveClass(
    'top-[76px]',
  );
});

test('撮影から15分ちょうどで古い表示、14分59秒では出さない', () => {
  renderLots([
    withImage(1, 'P5', '2026-11-14T04:55:00Z'),
    withImage(2, 'P7', '2026-11-14T04:55:01Z'),
  ]);
  const stale = screen.getAllByText(/古い画像の/);
  expect(stale).toHaveLength(1);
  expect(stale[0]).toHaveTextContent('13:55 撮影・古い画像の可能性があります');
  expect(stale[0].closest('li')).toBe(screen.getByText('P5').closest('li'));
  expect(screen.getByText('history')).toBeInTheDocument();
  expect(screen.getByText('13:55 撮影')).toBeInTheDocument();
});

test('長い駐車場名は44px・2行までで折り返し、バッジと更新行も出る', () => {
  renderLots([
    withImage(1, 'P5(共同教育学部棟駐車場)', '2026-11-14T05:05:00Z'),
  ]);
  expect(screen.getByText('P5(共同教育学部棟駐車場)')).toHaveClass(
    'line-clamp-2',
    'text-signage-title-lg',
    '[word-break:auto-phrase]',
  );
  expect(screen.getByText('空き')).toBeInTheDocument();
  expect(screen.getByText('14:05 更新')).toBeInTheDocument();
});
