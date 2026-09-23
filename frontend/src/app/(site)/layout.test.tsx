import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SiteLayout from './layout';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BottomNavigation } from '@/components/bottom-navigation';
import * as snsLinksModule from '@/lib/sns-links';
import * as phaseModule from '@/lib/phase';

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

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

// フェーズの解決自体は phase.test.ts の対象。ここでの関心事は解決結果を
// Header・Footer・BottomNavigation・下端余白へどう配線するかであるため、
// Cookie 値の実際の解釈は経由せずフェーズを直接差し替える
vi.mock('@/lib/phase', () => ({
  PHASE_OVERRIDE_COOKIE: 'aramakisai_phase_override',
  resolvePhase: vi.fn(),
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
  beforeEach(() => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'pre_event',
      source: 'constant',
    });
  });

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

  it('解決したフェーズを Header・Footer・BottomNavigation の全てへ揃えて渡す', async () => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'live',
      source: 'constant',
    });

    const layout = await SiteLayout({ children: <div>content</div> });

    expect((findElement(layout, Header).props as { phase: string }).phase).toBe(
      'live',
    );
    expect((findElement(layout, Footer).props as { phase: string }).phase).toBe(
      'live',
    );
    expect(
      (findElement(layout, BottomNavigation).props as { phase: string }).phase,
    ).toBe('live');
  });

  it('開催中フェーズのとき Footer より後ろ (枠の末尾) に下部ナビゲーション分の下端余白のスペーサーを与える (要件 8.6, 4.3)', async () => {
    vi.mocked(phaseModule.resolvePhase).mockReturnValue({
      phase: 'live',
      source: 'constant',
    });

    const layout = await SiteLayout({ children: <div>content</div> });
    const layoutProps = layout.props as { children: React.ReactElement[] };
    const children = React.Children.toArray(layoutProps.children);
    const footerIndex = children.findIndex(
      (child) => React.isValidElement(child) && child.type === Footer,
    );
    const bottomNavIndex = children.findIndex(
      (child) => React.isValidElement(child) && child.type === BottomNavigation,
    );
    const spacer = children
      .slice(footerIndex + 1, bottomNavIndex)
      .find((child): child is React.ReactElement =>
        React.isValidElement(child),
      );

    expect(spacer).toBeDefined();
    const spacerProps = spacer!.props as {
      className: string;
      'aria-hidden'?: string;
    };
    expect(spacerProps.className).toContain(
      'h-[calc(4rem+env(safe-area-inset-bottom))]',
    );
    expect(spacerProps.className).toContain('lg:hidden');
    expect(spacerProps['aria-hidden']).toBe('true');
  });

  it('開催前フェーズのとき Footer より後ろに余白のスペーサーを与えない (要件 2.5)', async () => {
    const layout = await SiteLayout({ children: <div>content</div> });
    const layoutProps = layout.props as { children: React.ReactElement[] };
    const children = React.Children.toArray(layoutProps.children);
    const footerIndex = children.findIndex(
      (child) => React.isValidElement(child) && child.type === Footer,
    );
    const bottomNavIndex = children.findIndex(
      (child) => React.isValidElement(child) && child.type === BottomNavigation,
    );

    // スペーサーが無ければ Footer の直後が BottomNavigation になる
    expect(bottomNavIndex - footerIndex).toBe(1);
  });
});
