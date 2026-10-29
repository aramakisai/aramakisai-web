import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StaffForbidden, StaffLoginFailed } from './staff-notice';
import { StaffNav } from './staff-nav';

describe('StaffNotice', () => {
  it('利用不可は見出しと案内だけを出す', () => {
    render(<StaffForbidden />);
    expect(
      screen.getByRole('heading', { name: '利用できません' }),
    ).toBeTruthy();
    expect(screen.getByText('実行委員のみ利用できます')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('ログイン失敗はログインへのリンクを出す', () => {
    render(<StaffLoginFailed />);
    expect(
      screen.getByRole('link', { name: 'ログイン' }).getAttribute('href'),
    ).toBe('/staff/auth/login');
  });
});

describe('StaffNav', () => {
  it('選択中のタブだけ aria-current を持つ', () => {
    render(<StaffNav selected="exchanges" />);
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual([
      '/staff/exchanges',
    ]);
  });

  it('読み取りボタンは scan 以外で出す', () => {
    const { rerender } = render(<StaffNav selected="dashboard" />);
    expect(
      screen.getByRole('link', { name: /QRを読み取る/ }).getAttribute('href'),
    ).toBe('/staff/scan');
    rerender(<StaffNav selected="scan" />);
    expect(screen.queryByRole('link', { name: /QRを読み取る/ })).toBeNull();
  });
});
