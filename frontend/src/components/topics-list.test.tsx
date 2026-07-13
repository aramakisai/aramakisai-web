import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { TopicsList } from './topics-list';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

describe('TopicsList', () => {
  const topics = [
    {
      id: 1,
      title: 'Topic 1',
      body: '<p>Body 1</p>',
      imageId: 'img1',
      linkUrl: 'https://example.com/link1',
      attachments: [],
    },
    {
      id: 2,
      title: 'Topic 2',
      body: null,
      imageId: null,
      linkUrl: null,
      attachments: [],
    },
  ];

  test('renders topics array with images, bodies and links', () => {
    render(<TopicsList topics={topics} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Topic 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Body 1')).toBeInTheDocument();
    const img1 = screen.getByAltText('Topic 1');
    expect(img1).toHaveAttribute('src', expect.stringContaining('img1'));
    const link1 = screen.getByRole('link', { name: '詳細を見る' });
    expect(link1).toHaveAttribute('href', 'https://example.com/link1');

    expect(
      screen.getByRole('heading', { level: 3, name: 'Topic 2' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Body 2')).not.toBeInTheDocument();
    const img2 = screen.getByAltText('Topic 2');
    expect(img2).toHaveAttribute('src', '/images/no-image.svg');
  });
});
