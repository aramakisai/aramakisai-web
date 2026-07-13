import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { FestivalOverview } from './festival-overview';

describe('FestivalOverview', () => {
  test('renders event days and admission fee', () => {
    render(
      <FestivalOverview
        festival={{
          name: '荒牧祭',
          eventDays: [{ label: '1日目', open: '09:00', close: '17:00' }],
          admissionFee: '無料',
          paymentNote: '事前登録不要',
          overviewHtml: null,
          heroImageId: null,
        }}
      />,
    );

    expect(screen.getByText('1日目')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
    expect(screen.getByText('無料')).toBeInTheDocument();
    expect(screen.getByText('事前登録不要')).toBeInTheDocument();
  });

  test('renders nothing when there is no data', () => {
    const { container } = render(
      <FestivalOverview
        festival={{
          name: '荒牧祭',
          eventDays: [],
          admissionFee: null,
          paymentNote: null,
          overviewHtml: null,
          heroImageId: null,
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
