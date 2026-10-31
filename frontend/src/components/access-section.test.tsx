import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { AccessSection } from './access-section';
import { CAMPUS_MAP_EMBED_URL, VENUE_NAME } from '@/lib/venue';

vi.mock('@/lib/use-bus-realtime', () => ({ useBusRealtime: () => null }));

const props = {
  summary: '案内',
  departures: [],
  fetchedAt: '2026-10-30T10:30:00.000Z',
};

describe('AccessSection', () => {
  test('見出しと導線を表示する', () => {
    render(<AccessSection {...props} summary="CMS の案内文" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'アクセス' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /アクセス詳細へ/ }),
    ).toHaveAttribute('href', '/access');
  });

  test('会場名を固定値、案内文をサイト設定の値で表示する', () => {
    render(<AccessSection {...props} summary="CMS の案内文" />);

    expect(screen.getByTestId('access-venue-name')).toHaveTextContent(
      `会場：${VENUE_NAME}`,
    );
    expect(screen.getByTestId('access-summary')).toHaveTextContent(
      'CMS の案内文',
    );
  });

  test('案内文の下に次の便の案内を出す', () => {
    render(<AccessSection {...props} />);

    expect(screen.getByTestId('bus-departure-board')).toBeInTheDocument();
    expect(screen.getAllByTestId('bus-departure-ended')).toHaveLength(2);
  });

  test('地図を固定の埋め込みURLでiframeに埋め込む', () => {
    const { container } = render(
      <AccessSection {...props} summary="CMS の案内文" />,
    );

    expect(container.querySelector('iframe')).toHaveAttribute(
      'src',
      CAMPUS_MAP_EMBED_URL,
    );
  });
});
