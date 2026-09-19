import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';

describe('Error', () => {
  it('エラーメッセージと再読み込みボタンが表示され、押下でresetが呼ばれる', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('test')} reset={reset} />);

    expect(
      screen.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
