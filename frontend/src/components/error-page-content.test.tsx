import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorPageContent } from './error-page-content';

describe('ErrorPageContent', () => {
  it('not-found: 404見出し・説明文・トップページへのリンクが表示される', () => {
    render(
      <ErrorPageContent
        variant="not-found"
        pageTitle="ページが見つかりません | 荒牧祭"
      />,
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'ページが見つかりません' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'お探しのページは移動または削除された可能性があります。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'トップページに戻る' }),
    ).toHaveAttribute('href', '/');
    expect(document.title).toBe('ページが見つかりません | 荒牧祭');
  });

  it('error: 見出し・説明文・再読み込みボタンが表示され、クリックでonResetが呼ばれる', () => {
    const onReset = vi.fn();
    render(
      <ErrorPageContent
        variant="error"
        pageTitle="エラーが発生しました | 荒牧祭"
        onReset={onReset}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'ページの表示中に問題が発生しました。時間をおいて再度お試しください。',
      ),
    ).toBeInTheDocument();
    expect(document.title).toBe('エラーが発生しました | 荒牧祭');

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
