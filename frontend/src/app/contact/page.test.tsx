import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContactPage from './page';
import * as staticPageModule from '@/lib/static-page';

vi.mock('@/lib/static-page', () => ({
  getContactPage: vi.fn(),
}));

describe('ContactPage', () => {
  it('本文とフォーム埋め込みが表示される', async () => {
    vi.mocked(staticPageModule.getContactPage).mockResolvedValue({
      title: 'お問い合わせ',
      contentHtml: '<p>お問い合わせ本文</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });

    render(await ContactPage());

    expect(
      screen.getByRole('heading', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('お問い合わせ本文')).toBeInTheDocument();
    expect(screen.getByTitle('お問い合わせフォーム')).toHaveAttribute(
      'src',
      'https://forms.example.com',
    );
  });

  it('取得エラー時はクラッシュせず見出しのみ表示', async () => {
    vi.mocked(staticPageModule.getContactPage).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await ContactPage());

    expect(
      screen.getByRole('heading', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();
  });
});
