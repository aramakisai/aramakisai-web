import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { BottomNavigation } from './bottom-navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

describe('BottomNavigation', () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue('/');
  });

  test('開催前フェーズでは DOM に出さない (要件 8.1, 8.3)', () => {
    const { container } = render(<BottomNavigation phase="pre_event" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('開催中フェーズでは 1024px 未満でのみ表示する CSS クラスを持つナビゲーションを描画する (要件 8.2)', () => {
    render(<BottomNavigation phase="live" />);
    const nav = screen.getByRole('navigation', { name: '下部ナビゲーション' });
    expect(nav).toHaveClass('lg:hidden');
  });

  test('ホームを中央に、design.md の表のとおり 5 項目を順に描画する (要件 8.8)', () => {
    render(<BottomNavigation phase="live" />);
    const links = screen.getAllByRole('link');
    const expected = [
      { label: '企画', href: '/exhibitions' },
      { label: 'マップ', href: '/map' },
      { label: 'ホーム', href: '/' },
      { label: 'タイムテーブル', href: '/timetable' },
      { label: '駐車場', href: '/parking' },
    ];
    expect(links).toHaveLength(expected.length);
    expected.forEach((item, index) => {
      expect(links[index]).toHaveAttribute('href', item.href);
      expect(links[index]).toHaveTextContent(item.label);
    });
  });

  test('現在地に aria-current="page" と不透明度 100% のインジケーターを与え、他の項目は不透明度 0 にする (要件 8.7, 8.10, 8.11)', () => {
    mockedUsePathname.mockReturnValue('/map');
    render(<BottomNavigation phase="live" />);

    const activeLink = screen.getByRole('link', { name: /マップ/ });
    expect(activeLink).toHaveAttribute('aria-current', 'page');
    const indicators = document.querySelectorAll(
      '[aria-hidden="true"].bg-secondary',
    );
    expect(indicators[0]).toHaveClass('opacity-100');

    const inactiveLink = screen.getByRole('link', { name: /^企画$/ });
    expect(inactiveLink).not.toHaveAttribute('aria-current');
  });

  test('項目ごとに固定の色をインジケーターへ割り当てる (要件 8.10)', () => {
    render(<BottomNavigation phase="live" />);
    const expected: Record<string, string> = {
      企画: 'bg-primary',
      マップ: 'bg-secondary',
      ホーム: 'bg-accent-alt',
      タイムテーブル: 'bg-info',
      駐車場: 'bg-accent',
    };
    Object.entries(expected).forEach(([label, colorClass]) => {
      const link = screen.getByRole('link', {
        name: new RegExp(`^${label}$`),
      });
      const indicator = link.querySelector('[aria-hidden="true"]');
      expect(indicator).toHaveClass(colorClass);
    });
  });

  test('アイコンは Material Symbols Sharp のリガチャで描画する (要件 21.9)', () => {
    render(<BottomNavigation phase="live" />);
    expect(screen.getByText('festival')).toHaveClass('material-symbols-sharp');
  });
});
