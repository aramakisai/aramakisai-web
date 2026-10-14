import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { AccessSection } from './access-section';
import { ACCESS_SUMMARY, CAMPUS_MAP_EMBED_URL, VENUE_NAME } from '@/lib/venue';

describe('AccessSection', () => {
  test('見出しと導線を表示する', () => {
    render(<AccessSection />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'アクセス' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /アクセス詳細へ/ }),
    ).toHaveAttribute('href', '/access');
  });

  test('会場名とアクセス文言を固定値から表示する', () => {
    render(<AccessSection />);

    expect(screen.getByTestId('access-venue-name')).toHaveTextContent(
      `会場：${VENUE_NAME}`,
    );
    expect(screen.getByTestId('access-summary')).toHaveTextContent(
      ACCESS_SUMMARY,
    );
  });

  test('地図を固定の埋め込みURLでiframeに埋め込む', () => {
    const { container } = render(<AccessSection />);

    expect(container.querySelector('iframe')).toHaveAttribute(
      'src',
      CAMPUS_MAP_EMBED_URL,
    );
  });
});
