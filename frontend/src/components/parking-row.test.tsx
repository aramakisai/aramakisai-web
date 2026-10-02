import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ParkingRow, ParkingStatusBadge } from './parking-row';

const NOW = new Date('2026-11-14T04:00:00Z'); // JST 13:00

function lot(updatedAt: string, status: 'available' | 'crowded' | 'full') {
  return { id: 1, name: '正門前駐車場', status, updatedAt };
}

describe('ParkingStatusBadge', () => {
  test.each([
    ['available', '空き', 'bg-success'],
    ['crowded', '混雑', 'bg-primary'],
    ['full', '満車', 'bg-warning'],
  ] as const)('%s は文字ラベルと色を持つ', (status, label, cls) => {
    render(<ParkingStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(cls);
  });
});

describe('ParkingRow', () => {
  test('通常の行は名称・バッジ・HH:mm更新を出す', () => {
    render(
      <ParkingRow lot={lot('2026-11-14T03:50:00Z', 'crowded')} now={NOW} />,
    );
    expect(screen.getByText('正門前駐車場')).toBeInTheDocument();
    expect(screen.getByText('混雑')).toBeInTheDocument();
    const time = screen.getByText('12:50更新');
    expect(time).toHaveClass('tabular-nums');
    expect(screen.queryByText('history')).not.toBeInTheDocument();
  });

  test('30分を超えた行は history アイコンと注記に置き換わる', () => {
    render(
      <ParkingRow lot={lot('2026-11-14T03:29:00Z', 'available')} now={NOW} />,
    );
    expect(screen.getByText('history')).toHaveClass('material-symbols-sharp');
    expect(
      screen.getByText('12:29更新・情報が古い可能性があります'),
    ).toBeInTheDocument();
    expect(screen.queryByText('12:29更新')).not.toBeInTheDocument();
  });

  test('ちょうど30分は古い扱いにしない', () => {
    render(<ParkingRow lot={lot('2026-11-14T03:30:00Z', 'full')} now={NOW} />);
    expect(screen.getByText('12:30更新')).toBeInTheDocument();
  });
});
