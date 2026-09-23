import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { SponsorsList } from './sponsors-list';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

describe('SponsorsList', () => {
  const sponsors = [
    { id: 1, name: 'Sponsor 1', logoId: 'file-1' },
    { id: 2, name: 'Sponsor 2', logoId: null },
    { id: 3, name: 'Sponsor 3', logoId: 'file-3' },
    { id: 4, name: 'Sponsor 4', logoId: 'file-4' },
    { id: 5, name: 'Sponsor 5', logoId: 'file-5' },
  ];

  test('見出しと2つの導線を常に表示する', () => {
    render(<SponsorsList sponsors={[]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: '協賛' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /広告協賛へ/ })).toHaveAttribute(
      'href',
      '/sponsors/ad',
    );
    expect(screen.getByRole('link', { name: /地域協賛へ/ })).toHaveAttribute(
      'href',
      '/sponsors/local',
    );
  });

  test('0件・取得失敗 (空配列) でもページの表示が続く', () => {
    render(<SponsorsList sponsors={[]} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '協賛' }),
    ).toBeInTheDocument();
  });

  test('ロゴがある協賛は画像、無い協賛は名称で表示し、4件までに絞る', () => {
    render(<SponsorsList sponsors={sponsors} />);

    const logo1 = screen.getByAltText('Sponsor 1');
    expect(logo1.tagName).toBe('IMG');
    expect(screen.getByText('Sponsor 2')).toBeInTheDocument();

    expect(screen.queryByAltText('Sponsor 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Sponsor 5')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});
