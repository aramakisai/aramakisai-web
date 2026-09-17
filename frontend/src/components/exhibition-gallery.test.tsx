import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExhibitionGallery } from './exhibition-gallery';
import type { ExhibitionImage } from '@/lib/exhibitions';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

describe('ExhibitionGallery', () => {
  const images: readonly ExhibitionImage[] = [
    { id: '1', alt: '写真1' },
    { id: '2', alt: '写真2' },
    { id: '3', alt: '写真3' },
  ];

  it('shows the first image as main and switches it when a thumbnail is selected', () => {
    render(<ExhibitionGallery images={images} fallbackAlt="企画名" />);

    expect(screen.getByRole('img', { name: '写真1' })).toBeInTheDocument();

    const thumbnails = screen.getAllByRole('button', { name: /写真/ });
    expect(thumbnails).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: '写真3' }));

    expect(screen.getByRole('img', { name: '写真3' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '写真1' })).not.toBeInTheDocument();
  });

  it('shows a no-image placeholder and no thumbnail row when there are no images', () => {
    render(<ExhibitionGallery images={[]} fallbackAlt="企画名" />);

    expect(screen.getByTestId('icon-hide-image')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
