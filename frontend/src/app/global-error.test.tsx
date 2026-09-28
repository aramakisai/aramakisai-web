import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

// GlobalError は FALLBACK_SITE_TITLE 経由で @/lib/site-metadata -> @/env を
// 読み込むため、実行時の環境変数検証を通すためにモックする
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

describe('GlobalError', () => {
  it('タイトルとnoindexメタタグが出力され、エラーメッセージと再読み込みボタンが表示され、押下でresetが呼ばれる', () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error('test')} reset={reset} />);

    expect(document.title).toBe('エラーが発生しました | 荒牧祭');
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex');

    expect(
      screen.getByRole('heading', { name: 'エラーが発生しました' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
