import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { TopicCard } from './topic-card';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

describe('TopicCard', () => {
  test('添付複数枚: uses first image attachment as thumbnail', () => {
    const attachments = [
      { id: 'doc1', filenameDownload: 'doc.pdf', type: 'application/pdf' },
      { id: 'img1', filenameDownload: 'img1.png', type: 'image/png' },
      { id: 'img2', filenameDownload: 'img2.jpg', type: 'image/jpeg' },
    ];
    render(
      <TopicCard
        id={1}
        title="Multiple Attachments"
        body="<p>test</p>"
        imageId="ignored_image_id"
        linkUrl="https://example.com"
        attachments={attachments}
      />,
    );

    const thumbnail = screen.getByAltText('Multiple Attachments');
    expect(thumbnail).toHaveAttribute('src', expect.stringContaining('img1'));
    expect(thumbnail).not.toHaveAttribute(
      'src',
      expect.stringContaining('ignored_image_id'),
    );
  });

  test('添付0件+imageIdあり: uses imageId as thumbnail', () => {
    render(
      <TopicCard
        id={2}
        title="Image ID Only"
        body="<p>test</p>"
        imageId="only_image_id"
        linkUrl="https://example.com"
        attachments={[]}
      />,
    );

    const thumbnail = screen.getByAltText('Image ID Only');
    expect(thumbnail).toHaveAttribute(
      'src',
      expect.stringContaining('only_image_id'),
    );
  });

  test('添付0件+imageIdなし(NO IMAGE表示): uses no-image fallback', () => {
    render(
      <TopicCard
        id={3}
        title="No Image"
        body="<p>test</p>"
        imageId={null}
        linkUrl="https://example.com"
        attachments={[]}
      />,
    );

    const thumbnail = screen.getByAltText('No Image');
    expect(thumbnail).toHaveAttribute('src', '/images/no-image.svg');
  });
});
