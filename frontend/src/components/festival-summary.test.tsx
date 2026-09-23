import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { FestivalSummary } from './festival-summary';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

describe('FestivalSummary', () => {
  test('renders RichText content when overviewHtml is provided', () => {
    const htmlContent = '<p>This is a summary of the festival.</p>';
    render(<FestivalSummary overviewHtml={htmlContent} />);

    expect(
      screen.getByText('This is a summary of the festival.'),
    ).toBeInTheDocument();
  });

  test('renders nothing when overviewHtml is null', () => {
    const { container } = render(<FestivalSummary overviewHtml={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when overviewHtml is an empty string', () => {
    const { container } = render(<FestivalSummary overviewHtml="" />);
    expect(container.firstChild).toBeNull();
  });
});
