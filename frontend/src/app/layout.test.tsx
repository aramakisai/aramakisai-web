import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from './layout';
import { Footer } from '@/components/footer';
import * as snsLinksModule from '@/lib/sns-links';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/font/google', () => ({
  Zen_Old_Mincho: () => ({ variable: 'font-zen-old-mincho' }),
}));

vi.mock('@/lib/festival-meta', () => ({
  getFestivalMeta: vi.fn(),
}));

vi.mock('@/lib/sns-links', () => ({
  getSnsLinks: vi.fn(),
}));

// RootLayout は <html>/<body> を返す都合上、jsdom へそのまま render できない。
// body の子要素として Footer コンポーネントそのものが配線されていることを検証したうえで、
// その要素を実行してレンダーし、SNS リンクが Directus の値で表示されることを確認する。
function findFooterElement(layout: React.ReactElement): React.ReactElement {
  const layoutProps = layout.props as { children: React.ReactElement[] };
  const body = layoutProps.children[0];
  const bodyProps = body.props as { children: React.ReactNode };
  const footerElement = React.Children.toArray(bodyProps.children).find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === Footer,
  );
  if (!footerElement) {
    throw new Error('layout.tsx から Footer 要素が見つからない');
  }
  return footerElement;
}

describe('RootLayout', () => {
  it('body内でFooterコンポーネントを配線し、SNSリンクをDirectusの値で表示する', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
    ]);

    const layout = RootLayout({ children: <div>content</div> });
    const footerElement = findFooterElement(layout);

    render(
      await (footerElement.type as (props: object) => Promise<React.ReactElement>)(
        footerElement.props as object,
      ),
    );

    expect(
      screen.getByRole('link', { name: '荒牧祭公式X' }),
    ).toHaveAttribute('href', 'https://x.com/aramakisai_');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
