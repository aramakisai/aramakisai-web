import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExhibitionCard } from './exhibition-card';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import { getExhibitionGradient } from '@/lib/exhibition-color';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

vi.mock('@/lib/exhibition-color', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/exhibition-color')>();
  return {
    ...actual,
    getExhibitionGradient: vi.fn(actual.getExhibitionGradient),
  };
});

const baseExhibition: ExhibitionCardSummary = {
  id: 1,
  category: 'exhibit',
  displayName: 'アラマキ祭実行委員会',
  organizationName: '実行委員会',
  location: '中央エリア A-1',
  areaIds: [1],
  thumbnail: null,
};

describe('ExhibitionCard', () => {
  it('renders the thumbnail photo, location and name when a photo exists', () => {
    const exhibition: ExhibitionCardSummary = {
      ...baseExhibition,
      thumbnail: { id: '42', alt: 'サムネイル画像' },
    };
    render(<ExhibitionCard exhibition={exhibition} />);

    expect(screen.getByRole('img', { name: 'サムネイル画像' })).toHaveAttribute(
      'src',
      'https://example.com/assets/42',
    );
    expect(screen.getByText('中央エリア A-1')).toBeInTheDocument();
    expect(screen.getByText('アラマキ祭実行委員会')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-image')).not.toBeInTheDocument();
  });

  it('renders a gray placeholder with the no-image icon when there is no photo', () => {
    render(<ExhibitionCard exhibition={baseExhibition} />);

    expect(screen.getByTestId('icon-image')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('omits the location when it is not set', () => {
    render(
      <ExhibitionCard exhibition={{ ...baseExhibition, location: null }} />,
    );

    expect(screen.queryByTestId('icon-place')).not.toBeInTheDocument();
  });

  it('links to the detail page for the card own category', () => {
    render(
      <ExhibitionCard
        exhibition={{ ...baseExhibition, id: 7, category: 'stage' }}
      />,
    );

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/exhibitions/7/stage',
    );
  });

  it('derives the gradient seed from the card display name (e.g. stage.name for stage cards), not any other field', () => {
    render(
      <ExhibitionCard
        exhibition={{
          ...baseExhibition,
          category: 'stage',
          displayName: '出演用の企画名',
        }}
      />,
    );

    expect(getExhibitionGradient).toHaveBeenCalledWith('出演用の企画名');
  });
});
