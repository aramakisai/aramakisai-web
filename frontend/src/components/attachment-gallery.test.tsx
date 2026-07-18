import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { AttachmentGallery } from './attachment-gallery';
import { Attachment } from '../lib/home-page-types';

vi.mock('../lib/directus-asset-url', () => ({
  toAssetUrl: (id: string | null) => {
    if (!id) return null;
    return `https://example.com/assets/${id}`;
  },
}));

describe('AttachmentGallery', () => {
  test('returns null when attachments array is empty', () => {
    const { container } = render(<AttachmentGallery attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders images and links correctly based on type', () => {
    const attachments: Attachment[] = [
      {
        id: 'img-1',
        filenameDownload: 'test-image.png',
        type: 'image/png',
      },
      {
        id: 'img-2',
        filenameDownload: 'test-photo.jpg',
        type: 'image/jpeg',
      },
      {
        id: 'doc-1',
        filenameDownload: 'document.pdf',
        type: 'application/pdf',
      },
      {
        id: 'doc-2',
        filenameDownload: 'unknown-file',
        type: null,
      },
      {
        id: 'doc-3',
        filenameDownload: 'text.txt',
        type: 'text/plain',
      },
    ];

    render(<AttachmentGallery attachments={attachments} />);

    // Test images
    const img1 = screen.getByAltText('test-image.png');
    expect(img1).toBeInTheDocument();
    expect(img1).toHaveAttribute('src', 'https://example.com/assets/img-1');

    const img2 = screen.getByAltText('test-photo.jpg');
    expect(img2).toBeInTheDocument();
    expect(img2).toHaveAttribute('src', 'https://example.com/assets/img-2');

    // Test non-images (links)
    const link1 = screen.getByRole('link', { name: 'document.pdf' });
    expect(link1).toBeInTheDocument();
    expect(link1).toHaveAttribute('href', 'https://example.com/assets/doc-1');
    expect(link1).toHaveAttribute('download');

    const link2 = screen.getByRole('link', { name: 'unknown-file' });
    expect(link2).toBeInTheDocument();
    expect(link2).toHaveAttribute('href', 'https://example.com/assets/doc-2');
    expect(link2).toHaveAttribute('download');

    const link3 = screen.getByRole('link', { name: 'text.txt' });
    expect(link3).toBeInTheDocument();
    expect(link3).toHaveAttribute('href', 'https://example.com/assets/doc-3');
    expect(link3).toHaveAttribute('download');
  });
});
