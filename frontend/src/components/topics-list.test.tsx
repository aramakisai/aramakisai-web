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

  test('variant="scroll" は 4 枚までに絞り「トピック一覧へ」を添える (design.md Requirement 3)', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Topic ${i + 1}`,
      imageId: null,
    }));

    render(<TopicsList topics={many} variant="scroll" />);

    expect(screen.getAllByRole('link', { name: /^Topic \d$/ })).toHaveLength(4);
    const seeAllLink = screen.getByRole('link', { name: /トピック一覧へ/ });
    expect(seeAllLink).toHaveAttribute('href', '/topics');
  });

  test('variant="scroll" でも 0 件のとき何も描画しない', () => {
    const { container } = render(<TopicsList topics={[]} variant="scroll" />);

    expect(container).toBeEmptyDOMElement();
  });

  test('variant を省略すると従来どおり件数を絞らず一覧導線も出さない', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Topic ${i + 1}`,
      imageId: null,
    }));

    render(<TopicsList topics={many} />);

    expect(screen.getAllByRole('link')).toHaveLength(6);
    expect(
      screen.queryByRole('link', { name: /トピック一覧へ/ }),
    ).not.toBeInTheDocument();
  });
});
