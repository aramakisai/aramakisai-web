import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { TopicsList } from './topics-list';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
  },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

describe('TopicsList', () => {
  const topics = [
    { id: 1, title: 'Topic 1', imageId: 'img1' },
    { id: 2, title: 'Topic 2', imageId: null },
  ];

  test('渡された順にトピックカードを並べる', () => {
    render(<TopicsList topics={topics} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/topics/1');
    expect(links[1]).toHaveAttribute('href', '/topics/2');
    expect(screen.getByText('Topic 1')).toBeInTheDocument();
    expect(screen.getByText('Topic 2')).toBeInTheDocument();
  });

  test('0件のとき何も描画しない', () => {
    const { container } = render(<TopicsList topics={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
