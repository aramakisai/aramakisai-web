import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { AccessSection } from './access-section';

describe('AccessSection', () => {
  test('見出しと導線を常に表示する', () => {
    render(<AccessSection venueName={null} accessSummary={null} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'アクセス' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /アクセス詳細へ/ }),
    ).toHaveAttribute('href', '/access');
  });

  test('会場名・文言がともに未設定のときはどちらも出さず導線のみ表示する', () => {
    render(<AccessSection venueName={null} accessSummary={null} />);

    expect(screen.queryByTestId('access-venue-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-summary')).not.toBeInTheDocument();
  });

  test('文言が空白のみのときも未設定として扱う', () => {
    render(<AccessSection venueName={null} accessSummary="   " />);

    expect(screen.queryByTestId('access-summary')).not.toBeInTheDocument();
  });

  test('文言があるときは改行を保って表示する', () => {
    render(<AccessSection venueName={null} accessSummary={'1行目\n2行目'} />);

    const summary = screen.getByTestId('access-summary');
    expect(summary).toHaveClass('whitespace-pre-wrap');
    expect(summary.textContent).toBe('1行目\n2行目');
  });

  test('会場名は「会場：」を付けて文言より上に表示する', () => {
    render(
      <AccessSection
        venueName="群馬大学 荒牧キャンパス"
        accessSummary="最寄駅から徒歩10分"
      />,
    );

    expect(screen.getByTestId('access-venue-name').textContent).toBe(
      '会場：群馬大学 荒牧キャンパス',
    );
  });

  test('会場名のみ設定のときは会場名だけ表示する', () => {
    render(
      <AccessSection
        venueName="群馬大学 荒牧キャンパス"
        accessSummary={null}
      />,
    );

    expect(screen.getByTestId('access-venue-name').textContent).toBe(
      '会場：群馬大学 荒牧キャンパス',
    );
    expect(screen.queryByTestId('access-summary')).not.toBeInTheDocument();
  });

  test('会場名が空白のみのときも未設定として扱う', () => {
    render(
      <AccessSection venueName="   " accessSummary="最寄駅から徒歩10分" />,
    );

    expect(screen.queryByTestId('access-venue-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('access-summary')).toBeInTheDocument();
  });
});
