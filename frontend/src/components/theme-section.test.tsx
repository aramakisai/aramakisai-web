import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ThemeSection } from './theme-section';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: () => null,
}));

describe('ThemeSection', () => {
  test('テーマ語があれば「テーマ「{word}」」の見出しと趣旨文を表示する', () => {
    render(
      <ThemeSection themeWord="万彩" descriptionHtml="<p>趣旨文です。</p>" />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'テーマ「万彩」' }),
    ).toBeInTheDocument();
    expect(screen.getByText('趣旨文です。')).toBeInTheDocument();
    expect(document.getElementById('theme')).not.toBeNull();
  });

  test('テーマ語が無ければ見出しは「テーマ」', () => {
    render(<ThemeSection themeWord={null} descriptionHtml="<p>趣旨文</p>" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'テーマ' }),
    ).toBeInTheDocument();
  });

  test.each([null, ''])('趣旨文が %j ならセクションを描画しない', (html) => {
    const { container } = render(
      <ThemeSection themeWord="万彩" descriptionHtml={html} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
