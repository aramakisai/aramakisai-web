import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorPageContent } from './error-page-content';
import { sendGaEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({ sendGaEvent: vi.fn() }));

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

  it('error: 見出し・説明文・再読み込みボタンが表示され、クリックでonRetryが呼ばれる', async () => {
    const onRetry = vi.fn();
    const { unmount } = render(
      <ErrorPageContent
        variant="error"
        pageTitle="エラーが発生しました | 荒牧祭"
        onRetry={onRetry}
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
    expect(onRetry).toHaveBeenCalledOnce();

    // 再試行フラグがモジュール変数のため、後続テストに持ち越さないよう消化する
    unmount();
    await new Promise((r) => setTimeout(r, 0));
  });

  describe('GA送信', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.clearAllMocks();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const errorEl = (extra = {}) => (
      <ErrorPageContent
        variant="error"
        pageTitle="t"
        onRetry={vi.fn()}
        {...extra}
      />
    );

    it('not-found表示でnot_foundを送る', () => {
      render(<ErrorPageContent variant="not-found" pageTitle="t" />);
      expect(sendGaEvent).toHaveBeenCalledWith('error_page', {
        result: 'not_found',
      });
    });

    it('error表示でerror_digest付きerrorを送り、scope=globalではglobal_error', () => {
      const a = render(errorEl({ digest: 'abc' }));
      expect(sendGaEvent).toHaveBeenCalledWith('error_page', {
        result: 'error',
        error_digest: 'abc',
      });
      a.unmount();
      render(errorEl({ scope: 'global' }));
      expect(sendGaEvent).toHaveBeenLastCalledWith('error_page', {
        result: 'global_error',
      });
    });

    it('再試行押下後に再マウントされるとretry_failだけ送りerrorは重ねない', () => {
      const first = render(errorEl());
      vi.clearAllMocks();
      fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
      first.unmount();
      render(errorEl());
      act(() => {
        vi.runAllTimers();
      });
      expect(sendGaEvent).toHaveBeenCalledTimes(1);
      expect(sendGaEvent).toHaveBeenCalledWith('error_page', {
        result: 'retry_fail',
      });
    });

    it('再試行押下後に再マウントなしでアンマウントされるとretry_successを1回送る', () => {
      const first = render(errorEl());
      vi.clearAllMocks();
      fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
      first.unmount();
      act(() => {
        vi.runAllTimers();
      });
      expect(sendGaEvent).toHaveBeenCalledTimes(1);
      expect(sendGaEvent).toHaveBeenCalledWith('error_page', {
        result: 'retry_success',
      });
    });

    it('再試行を押さないアンマウントでは何も送らない', () => {
      const first = render(errorEl());
      vi.clearAllMocks();
      first.unmount();
      act(() => {
        vi.runAllTimers();
      });
      expect(sendGaEvent).not.toHaveBeenCalled();
    });
  });
});
