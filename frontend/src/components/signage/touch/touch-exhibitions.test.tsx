import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TouchExhibitions } from './touch-exhibitions';
import type { ExhibitionCardSummary } from '@/lib/exhibitions';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => (id ? `https://example.com/${id}` : null),
}));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:8055' },
}));
vi.mock('@/lib/cms', () => ({ cms: {} }));

function card(
  id: number,
  category: ExhibitionCardSummary['category'],
  displayName: string,
): ExhibitionCardSummary {
  return {
    id,
    category,
    displayName,
    organizationName: '団体',
    location: 'Aゾーン',
    areaIds: [1],
    thumbnail: null,
  };
}

const cards = [
  card(1, 'exhibit', '写真展'),
  card(2, 'vendor', 'たこ焼き'),
  card(3, 'stage', 'ライブ'),
];

describe('TouchExhibitions', () => {
  it('全件を 6 列で出し、ページ送り・検索・ブックマークを出さない', () => {
    const { container } = render(<TouchExhibitions cards={cards} />);
    expect(screen.getByText('写真展')).toBeInTheDocument();
    expect(screen.getByText('たこ焼き')).toBeInTheDocument();
    expect(screen.getByText('ライブ')).toBeInTheDocument();
    expect(container.querySelector('.grid-cols-6')).not.toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByLabelText(/ブックマーク/)).toBeNull();
    expect(screen.queryByText(/ページ/)).toBeNull();
  });

  it('企画名は 2 行・場所は 1 行までで省略する', () => {
    render(<TouchExhibitions cards={cards} />);
    expect(screen.getByText('写真展')).toHaveClass('line-clamp-2');
    expect(screen.getAllByText('Aゾーン')[0]).toHaveClass('truncate');
  });

  it('スクロール内容の下端に余白 240 を置く', () => {
    const { container } = render(<TouchExhibitions cards={cards} />);
    expect(container.firstElementChild).toHaveClass('pb-[240px]');
  });

  it('カテゴリは ステージ・展示・出店・その他 の順で、選ぶと一覧が絞り込まれる', () => {
    render(<TouchExhibitions cards={cards} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['ステージ', '展示', '出店', 'その他']);
    fireEvent.click(screen.getByRole('button', { name: '出店' }));
    expect(screen.getByText('たこ焼き')).toBeInTheDocument();
    expect(screen.queryByText('写真展')).toBeNull();
    expect(screen.queryByText('ライブ')).toBeNull();
  });

  it('該当が無いと「条件に一致する企画はありません」を出す', () => {
    render(<TouchExhibitions cards={cards} />);
    fireEvent.click(screen.getByRole('button', { name: 'その他' }));
    expect(
      screen.getByText('条件に一致する企画はありません'),
    ).toBeInTheDocument();
  });

  it('絞り込みを URL に書かない', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const push = vi.spyOn(window.history, 'pushState');
    render(<TouchExhibitions cards={cards} />);
    fireEvent.click(screen.getByRole('button', { name: '展示' }));
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
