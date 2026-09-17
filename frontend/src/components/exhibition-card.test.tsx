import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExhibitionCard } from './exhibition-card';
import type { ExhibitionSummary } from '@/lib/exhibitions';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

const baseExhibition: ExhibitionSummary = {
  id: 1,
  name: 'アラマキ祭実行委員会',
  stageName: 'アラマキ祭実行委員会',
  organizationName: '実行委員会',
  categories: ['exhibit'],
  location: '中央エリア A-1',
  areaIds: [1],
  thumbnail: null,
};

describe('ExhibitionCard', () => {
  it('renders the thumbnail photo, location and name when a photo exists', () => {
    const exhibition: ExhibitionSummary = {
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

  it('links the whole card to the exhibition detail page', () => {
    render(<ExhibitionCard exhibition={baseExhibition} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/exhibitions/1');
  });

  it('omits the location when it is not set', () => {
    render(
      <ExhibitionCard exhibition={{ ...baseExhibition, location: null }} />,
    );

    expect(screen.queryByTestId('icon-place')).not.toBeInTheDocument();
  });
});
