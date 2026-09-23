import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AboutSection } from './about-section';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

describe('AboutSection', () => {
  test('固定文言「荒牧祭とは」の見出しと概要文を表示する (Figma 119:3)', () => {
    render(
      <AboutSection overviewHtml="<p>群馬大学荒牧キャンパスを彩る学園祭。</p>" />,
    );

    const heading = screen.getByRole('heading', {
      level: 2,
      name: '荒牧祭とは',
    });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText('群馬大学荒牧キャンパスを彩る学園祭。'),
    ).toBeInTheDocument();
  });

  test('ヘッダー/フッターの `/#about` リンク先として id="about" を持つ', () => {
    render(<AboutSection overviewHtml="<p>概要</p>" />);

    expect(document.getElementById('about')).not.toBeNull();
  });

  test('概要文が未設定のときは見出しのみを表示する', () => {
    render(<AboutSection overviewHtml={null} />);

    expect(
      screen.getByRole('heading', { level: 2, name: '荒牧祭とは' }),
    ).toBeInTheDocument();
  });
});
