import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SiteLayout from './layout';
import { Header } from '@/components/header';
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

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

// SiteLayout はサーバーコンポーネントの子として Header/Footer を返す都合上、
// jsdom へそのまま render できない。body の子要素として該当コンポーネントそのものが
// 配線されていることを検証したうえで、その要素を実行してレンダーする。
function findElement(
  layout: React.ReactElement,
  type: unknown,
): React.ReactElement {
  const layoutProps = layout.props as { children: React.ReactElement[] };
  const element = React.Children.toArray(layoutProps.children).find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === type,
  );
  if (!element) {
    throw new Error('layout.tsx から該当要素が見つからない');
  }
  return element;
}

describe('SiteLayout', () => {
  it('Footerコンポーネントを配線し、SNSリンクをDirectusの値で表示する', async () => {
    vi.mocked(snsLinksModule.getSnsLinks).mockResolvedValue([
      { platform: 'X', url: 'https://x.com/aramakisai_' },
    ]);

    const layout = await SiteLayout({ children: <div>content</div> });
    const footerElement = findElement(layout, Footer);

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

  it('Cookie 未設定時、解決したビルド時フェーズを Header と Footer の双方へ渡す', async () => {
    const layout = await SiteLayout({ children: <div>content</div> });

    expect((findElement(layout, Header).props as { phase: string }).phase).toBe(
      'pre_event',
    );
    expect((findElement(layout, Footer).props as { phase: string }).phase).toBe(
      'pre_event',
    );
  });
});
