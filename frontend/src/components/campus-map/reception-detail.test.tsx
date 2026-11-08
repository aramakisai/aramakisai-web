import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceptionDetail } from './reception-detail';

const point = {
  id: 1,
  kind: 'reception' as const,
  latitude: 36,
  longitude: 139,
};

describe('受付詳細', () => {
  it('パンフレット未設定時にはリンクを出さず、設定時には出す', () => {
    const { rerender } = render(
      <ReceptionDetail point={point} onClose={vi.fn()} />,
    );
    expect(
      screen.queryByText('デジタルパンフレットを見る'),
    ).not.toBeInTheDocument();
    rerender(
      <ReceptionDetail
        point={point}
        pamphletUrl="/topics/12"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('デジタルパンフレットを見る')).toHaveAttribute(
      'href',
      '/topics/12',
    );
  });
  it('専用受付は登録画像を比率を維持して表示し、未登録でも動く', () => {
    const comedy = {
      ...point,
      receptionType: 'comedy' as const,
      label: 'ママタルトお笑いライブ専用受付',
    };
    const { rerender } = render(
      <ReceptionDetail point={comedy} onClose={vi.fn()} />,
    );
    expect(screen.getByText('ママタルトお笑いライブ受付')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(
      screen.queryByText('お笑いライブの詳細を見る'),
    ).not.toBeInTheDocument();
    rerender(
      <ReceptionDetail
        point={{ ...comedy, posterUrl: '/poster.webp' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByAltText('お笑いライブのポスター')).toBeInTheDocument();
    expect(
      screen.queryByText('お笑いライブの詳細を見る'),
    ).not.toBeInTheDocument();
    rerender(
      <ReceptionDetail
        point={{ ...comedy, posterUrl: '/poster.webp', eventUrl: '/topics/2' }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByAltText('お笑いライブのポスター')).toHaveClass(
      'object-contain',
      'h-auto',
    );
    expect(screen.getByText('お笑いライブの詳細を見る')).toHaveAttribute(
      'href',
      '/topics/2',
    );
  });
});
