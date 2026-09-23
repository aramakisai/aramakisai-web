import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { AttachmentGallery } from './attachment-gallery';
import { Attachment } from '../lib/home-page-types';

vi.mock('../lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => {
    if (!id) return null;
    return `https://example.com/assets/${id}`;
  },
}));

describe('AttachmentGallery', () => {
  test('添付が 0 件のときは何も描画しない', () => {
    const { container } = render(<AttachmentGallery attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('画像も他形式と同じ行で表示し、拡張子・MB 単位のサイズを示す', () => {
    const attachments: Attachment[] = [
      {
        id: 'doc-1',
        filenameDownload: '会場配置図(変更後).pdf',
        type: 'application/pdf',
        filesize: 1782579, // 1.7 MB
      },
      {
        id: 'img-1',
        filenameDownload: 'photo.png',
        type: 'image/png',
        filesize: 204800, // 200 KB
      },
    ];

    render(<AttachmentGallery attachments={attachments} />);

    const link1 = screen.getByRole('link', {
      name: /会場配置図\(変更後\)\.pdf/,
    });
    expect(link1).toHaveAttribute('href', 'https://example.com/assets/doc-1');
    expect(link1).toHaveAttribute('target', '_blank');
    expect(link1).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link1).not.toHaveAttribute('download');
    expect(link1).toHaveTextContent('PDF・1.7 MB');

    const link2 = screen.getByRole('link', { name: /photo\.png/ });
    expect(link2).toHaveTextContent('PNG・200 KB');
    // 画像も <img> ではなくファイル名の行として表示する
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('拡張子が無いファイル名は mimeType のサブタイプを形式として表示する', () => {
    const attachments: Attachment[] = [
      {
        id: 'doc-2',
        filenameDownload: 'README',
        type: 'text/plain',
        filesize: 1024,
      },
    ];

    render(<AttachmentGallery attachments={attachments} />);

    expect(screen.getByRole('link')).toHaveTextContent('PLAIN・1 KB');
  });
});
