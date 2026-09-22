import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { FestivalOverview } from './festival-overview';

describe('FestivalOverview', () => {
  test('renders event days and admission fee', () => {
    render(
      <FestivalOverview
        festival={{
          name: '荒牧祭',
          eventDays: [
            {
              label: '1日目',
              startAt: '2026-09-27T00:00:00.000Z',
              endAt: '2026-09-27T08:00:00.000Z',
            },
          ],
          overviewHtml: null,
          heroImageId: null,
        }}
      />,
    );

    expect(screen.getByText('1日目')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
  });

  test('未入力の表示ラベルは開場日時から生成した文言を出す', () => {
    render(
      <FestivalOverview
        festival={{
          name: '荒牧祭',
          eventDays: [
            {
              label: null,
              startAt: '2026-09-27T00:00:00.000Z',
              endAt: '2026-09-27T08:00:00.000Z',
            },
          ],
          overviewHtml: null,
          heroImageId: null,
        }}
      />,
    );

    expect(screen.getByText('9月27日(日)')).toBeInTheDocument();
  });

  test('renders nothing when there is no data', () => {
    const { container } = render(
      <FestivalOverview
        festival={{
          name: '荒牧祭',
          eventDays: [],
          overviewHtml: null,
          heroImageId: null,
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
