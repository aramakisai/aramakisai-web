import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SiteLayout from './layout';
import { Footer } from '@/components/footer';
import * as snsLinksModule from '@/lib/sns-links';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/lib/festival-meta', () => ({
  getContactFormUrl: vi.fn(),
}));

vi.mock('@/lib/sns-links', () => ({
  getSnsLinks: vi.fn(),
}));

// SiteLayout はサーバーコンポーネントの子として Footer を返す都合上、
// jsdom へそのまま render できない。body の子要素として Footer コンポーネントそのものが
// 配線されていることを検証したうえで、その要素を実行してレンダーし、
// SNS リンクが Directus の値で表示されることを確認する。
function findFooterElement(layout: React.ReactElement): React.ReactElement {
  const layoutProps = layout.props as { children: React.ReactElement[] };
  const footerElement = React.Children.toArray(layoutProps.children).find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === Footer,
  );
  if (!footerElement) {
    throw new Error('layout.tsx から Footer 要素が見つからない');
  }
  return footerElement;
}

describe('SiteLayout', () => {
  it('Footerコンポーネントを配線し、SNSリンクをDirectusの値で表示する', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
    ]);

    const layout = SiteLayout({ children: <div>content</div> });
    const footerElement = findFooterElement(layout);

    render(
      await (
        footerElement.type as (props: object) => Promise<React.ReactElement>
      )(footerElement.props as object),
    );

    expect(screen.getByRole('link', { name: '荒牧祭公式X' })).toHaveAttribute(
      'href',
      'https://x.com/aramakisai_',
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
