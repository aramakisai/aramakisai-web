import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { TopicCard } from './topic-card';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
  },
}));

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

describe('TopicCard', () => {
  test('imageId ありのときサムネイルを表示する', () => {
    render(
      <TopicCard id={1} title="デジタルパンフレット公開" imageId="img1" />,
    );

    const thumbnail = screen.getByAltText('デジタルパンフレット公開');
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/assets/img1');
    expect(screen.queryByTestId('icon-image')).not.toBeInTheDocument();
  });

  test('imageId なしのとき企画カードと同じ代替画像を表示する', () => {
    render(<TopicCard id={2} title="お知らせのみ" imageId={null} />);

    expect(screen.getByTestId('icon-image')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('カード全体が1つのリンクでトピック詳細へ遷移する', () => {
    render(<TopicCard id={7} title="ステージタイムテーブル" imageId={null} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/topics/7');
  });

  test('タイトルを表示する', () => {
    render(<TopicCard id={3} title="キッチンカー出店情報" imageId={null} />);

    expect(screen.getByText('キッチンカー出店情報')).toBeInTheDocument();
  });

  test('カードは4:3固定で、打ち切り要素に余白を持たない', () => {
    render(<TopicCard id={4} title="長いタイトルのトピック" imageId={null} />);

    const link = screen.getByRole('link');
    expect(link.className).toMatch(/aspect-\[4\/3\]/);

    // line-clamp と padding を同一要素に置くと overflow:hidden がパディングボックスで
    // 切ってしまい、はみ出た行が下端の余白に描画される。padding は親 (Link) 側にあること
    const title = screen.getByText('長いタイトルのトピック');
    expect(title.className).toMatch(/line-clamp-2/);
    expect(title.className).not.toMatch(/\bp-4\b/);
  });

  test('タイトルは LINE Seed JP Bold 20px (見出し既定の ExtraBold を上書き)', () => {
    render(<TopicCard id={5} title="模擬店マップ" imageId={null} />);

    const title = screen.getByText('模擬店マップ');
    expect(title).toHaveClass('font-bold');
    expect(title.tagName).toBe('H4'); // h4 の既定サイズ 20px をそのまま使う
  });

  test('不透明な面として印を付ける', () => {
    render(<TopicCard id={6} title="模擬店マップ" imageId={null} />);
    expect(screen.getByRole('link')).toHaveAttribute('data-bg-opaque');
  });
});
