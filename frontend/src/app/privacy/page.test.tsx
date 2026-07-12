import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PrivacyPage from './page';
import * as staticPageModule from '@/lib/static-page';

vi.mock('@/lib/static-page', () => ({
  getPrivacyPage: vi.fn(),
}));

describe('PrivacyPage', () => {
  it('本文が表示される', async () => {
    vi.mocked(staticPageModule.getPrivacyPage).mockResolvedValue({
      contentHtml: '<p>プライバシー本文</p>',
      embedUrl: null,
    });

    render(await PrivacyPage());

    expect(
      screen.getByRole('heading', { name: 'プライバシーポリシー' }),
    ).toBeInTheDocument();
    expect(screen.getByText('プライバシー本文')).toBeInTheDocument();
  });

  it('取得エラー時はクラッシュせず見出しのみ表示', async () => {
    vi.mocked(staticPageModule.getPrivacyPage).mockRejectedValue(
      new Error('Directus Error'),
    );

    render(await PrivacyPage());

    expect(
      screen.getByRole('heading', { name: 'プライバシーポリシー' }),
    ).toBeInTheDocument();
  });
});
