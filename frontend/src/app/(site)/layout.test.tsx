import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SiteLayout from './layout';
import { Footer } from '@/components/footer';
import {
  PhasedBottomNavigation,
  PhasedBottomSpacer,
  PhasedHeader,
} from '@/components/phased-chrome';
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

// useMotionPreference は window.matchMedia に依存する (footer.test.tsx と同様、
// このテストの関心事はレイアウトの配線であり matchMedia の挙動ではないためスタブする)
vi.mock('@/components/motion-toggle', () => ({
  MotionToggle: () => <button type="button">モーション</button>,
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

    const layout = SiteLayout({ children: <div>content</div> });
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

  it('Header・余白・BottomNavigation は Cookie を読むクライアント側へ任せる', () => {
    const layout = SiteLayout({ children: <div>content</div> });
    const children = React.Children.toArray(
      (layout.props as { children: React.ReactElement[] }).children,
    ).filter(React.isValidElement);

    const order = children.map((c) => c.type);
    expect(order.indexOf(PhasedHeader)).toBeGreaterThanOrEqual(0);
    // 余白は Footer の後ろ、BottomNavigation の前に置かないと Footer の下端が隠れる
    expect(order.indexOf(PhasedBottomSpacer)).toBe(order.indexOf(Footer) + 1);
    expect(order.indexOf(PhasedBottomNavigation)).toBe(
      order.indexOf(PhasedBottomSpacer) + 1,
    );
  });
});
