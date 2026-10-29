import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AreaStat, TargetStat } from '@/lib/stamp-aggregate';
import { StaffTargetFilter } from './staff-target-filter';

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

const stat = (
  id: number,
  category: TargetStat['category'],
  displayName: string,
  organizationName: string,
  areaId: number | null,
): TargetStat => ({
  exhibitionId: id,
  category,
  displayName,
  organizationName,
  areaId,
  visitorCount: 1,
  rate: 0.5,
});
const targets = [
  stat(1, 'exhibit', '写真展', '写真部', 1),
  stat(2, 'vendor', 'クレープ', '料理研究会', 1),
  stat(3, 'exhibit', 'ジオラマ', '鉄道研究会', 2),
  stat(4, 'other', '休憩所', '実行委員会', null),
];
const area = (areaId: number | null, areaName: string): AreaStat => ({
  areaId,
  areaName,
  collected: 0,
  averagePercent: 0,
});
const areas = [
  area(1, '中央エリア'),
  area(2, '南エリア'),
  area(null, 'エリア不明'),
];

describe('StaffTargetFilter', () => {
  it('既定は全件で件数を出し、エリア不明のチップは出さない', () => {
    render(<StaffTargetFilter targets={targets} areas={areas} />);
    expect(screen.getByText('全 4 件')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'エリア不明' })).toBeNull();
  });

  it('カテゴリは単一選択で、押下中を再度押すと解除する', () => {
    render(<StaffTargetFilter targets={targets} areas={areas} />);
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    expect(screen.getByText('全 2 件')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '出店' }));
    expect(screen.getByText('全 1 件')).toBeTruthy();
    expect(screen.getByText('クレープ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '出店' }));
    expect(screen.getByText('全 4 件')).toBeTruthy();
  });

  it('カテゴリとエリアを重ねて絞り込む', () => {
    render(<StaffTargetFilter targets={targets} areas={areas} />);
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    fireEvent.click(screen.getByRole('button', { name: '南エリア' }));
    expect(screen.getByText('全 1 件')).toBeTruthy();
    expect(screen.getByText('ジオラマ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '中央エリア' }));
    expect(screen.getByText('全 1 件')).toBeTruthy();
    expect(screen.getByText('写真展')).toBeTruthy();
  });

  it('キーワードは企画名と団体名を正規化して部分一致で見る', () => {
    render(<StaffTargetFilter targets={targets} areas={areas} />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '研究会' },
    });
    expect(screen.getByText('全 2 件')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'ｸﾚｰﾌﾟ' },
    });
    expect(screen.getByText('クレープ')).toBeTruthy();
  });

  it('該当なしは件数の代わりに案内を出す', () => {
    render(<StaffTargetFilter targets={targets} areas={areas} />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '天文' },
    });
    expect(screen.getByText('条件に一致する企画はありません')).toBeTruthy();
    expect(screen.queryByText(/^全 \d+ 件$/)).toBeNull();
  });
});
