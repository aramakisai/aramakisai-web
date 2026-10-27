import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExhibitionCard } from './exhibition-card';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';
import { getExhibitionTexture } from '@/lib/exhibition-color';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

vi.mock('./bookmark-button', () => ({
  BookmarkButton: () => <button type="button">bookmark</button>,
}));

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

  it('keeps the location row hidden from view and readers when it is not set', () => {
    render(
      <ExhibitionCard exhibition={{ ...baseExhibition, location: null }} />,
    );

    const row = screen.getByTestId('icon-place').parentElement!;
    expect(row).toHaveClass('invisible');
    expect(row).toHaveAttribute('aria-hidden', 'true');
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

  it('paints the lower area with the pamphlet texture chosen from the display name', () => {
    const name = '出演用の企画名';
    const { texture, position, rotation } = getExhibitionTexture(name);
    render(
      <ExhibitionCard
        exhibition={{ ...baseExhibition, category: 'stage', displayName: name }}
      />,
    );

    const bg = screen
      .getByRole('heading', { name })
      .closest('a')!
      .querySelector<HTMLElement>('[style*="/images/textures/"]')!;
    expect(bg.style.backgroundImage).toBe(
      `url("/images/textures/pamphlet/${texture}.webp")`,
    );
    expect(bg.style.backgroundSize).toBe('250% auto');
    expect(bg.style.transform).toContain(`rotate(${rotation}deg)`);
    expect(bg.style.backgroundPosition).toBe(`${position[0]}% ${position[1]}%`);
  });

  it('renders no bookmark button by default and links to the detail page', () => {
    render(<ExhibitionCard exhibition={baseExhibition} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/exhibitions/1/exhibit',
    );
  });

  it('renders the bookmark button as a sibling of the link when bookmarkable', () => {
    render(<ExhibitionCard exhibition={baseExhibition} bookmarkable />);

    const link = screen.getByRole('link');
    const button = screen.getByRole('button');
    expect(link.contains(button)).toBe(false);
    expect(link.parentElement).toBe(button.parentElement);
    expect(link).toHaveAttribute('href', '/exhibitions/1/exhibit');
  });
});
