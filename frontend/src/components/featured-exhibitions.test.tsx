import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeaturedExhibitions } from './featured-exhibitions';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

// exhibitions.ts が ./cms 経由で読む env.ts のバリデーションを避ける (exhibition-filters.test.tsx と同じ)
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));

function makeExhibition(id: number): ExhibitionCardSummary {
  return {
    id,
    category: 'exhibit',
    displayName: `企画${id}`,
    organizationName: `団体${id}`,
    location: null,
    areaIds: [],
    thumbnail: null,
  };
}

describe('FeaturedExhibitions', () => {
  it('renders no cards but keeps the /exhibitions link when there are no exhibitions (fetch failure or empty)', () => {
    render(<FeaturedExhibitions exhibitions={[]} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/exhibitions');
    expect(links[0]).toHaveTextContent('企画一覧へ');
  });

  it('renders up to 4 cards, all drawn from the given exhibitions, plus the link to /exhibitions', () => {
    const source = Array.from({ length: 10 }, (_, i) => makeExhibition(i + 1));
    render(<FeaturedExhibitions exhibitions={source} />);

    const cardLinks = source
      .map((e) =>
        screen.queryByRole('link', {
          name: new RegExp(`^${e.displayName}$`),
        }),
      )
      .filter((el): el is HTMLElement => el !== null);
    expect(cardLinks).toHaveLength(4);

    const seeAllLink = screen.getByRole('link', { name: /企画一覧へ/ });
    expect(seeAllLink).toHaveAttribute('href', '/exhibitions');
  });

  it('renders exactly as many cards as given when fewer than 4 are available', () => {
    const source = [makeExhibition(1), makeExhibition(2)];
    render(<FeaturedExhibitions exhibitions={source} />);

    expect(
      screen.getByRole('link', { name: source[0]!.displayName }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: source[1]!.displayName }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /企画一覧へ/ }),
    ).toBeInTheDocument();
  });
});
