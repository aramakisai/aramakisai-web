import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { NavigationMenuRows } from './navigation-menu-rows';
import { navigationItemsByPhase } from '@/lib/navigation';

describe('NavigationMenuRows', () => {
  test('行の高さは 48px で、閉じた行の下に区切り線を持つ', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.live}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    const link = screen.getByRole('link', { name: '企画一覧' });
    expect(link).toHaveClass('min-h-12');
    expect(link.closest('li')).toHaveClass('border-b', 'border-gray-200');
  });

  test('最後の行には区切り線を持たない (パネル外周の border-b と重なるため)', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.live}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    const lastRow = screen
      .getByRole('button', { name: /ご案内/ })
      .closest('li');
    expect(lastRow).not.toHaveClass('border-b');
  });

  test('開いた親の子項目一覧の後に続く行との間に区切り線がない', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    // 開く前は閉じた行として区切り線を持つ
    const guidanceRowBeforeOpen = screen
      .getByRole('button', { name: /ご案内/ })
      .closest('li');
    expect(guidanceRowBeforeOpen).toHaveClass('border-b');

    fireEvent.click(screen.getByRole('button', { name: /ご案内/ }));

    // 開いた行自身には区切り線がない
    const guidanceRow = screen
      .getByRole('button', { name: /ご案内/ })
      .closest('li');
    expect(guidanceRow).not.toHaveClass('border-b');

    // 開いた子項目一覧のすぐ後に続く行 (協賛) の上にも区切り線が出ない
    const sponsorRow = screen
      .getByRole('button', { name: /協賛/ })
      .closest('li');
    expect(sponsorRow).not.toHaveClass('border-b');
  });

  test('子項目は 16px の追加インデントと左の縦線を持つ', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.live}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ご案内/ }));
    const childLink = screen.getByRole('link', { name: 'アクセス' });
    expect(childLink).toHaveClass('pl-8', 'text-sm', 'leading-[1.6]');
    expect(childLink.parentElement).toHaveClass('border-l', 'border-gray-200');
  });

  test('複数の親項目をそれぞれ独立して同時に開ける', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.live}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /お知らせ/ }));
    fireEvent.click(screen.getByRole('button', { name: /ご案内/ }));

    expect(
      screen.getByRole('list', { name: 'お知らせのサブメニュー' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'ご案内のサブメニュー' }),
    ).toBeInTheDocument();

    // 片方を閉じてももう片方は開いたまま
    fireEvent.click(screen.getByRole('button', { name: /お知らせ/ }));
    expect(
      screen.queryByRole('list', { name: 'お知らせのサブメニュー' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'ご案内のサブメニュー' }),
    ).toBeInTheDocument();
  });

  test('子項目を持つ行は開閉アイコンと状態属性を持つ', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.live}
        pathname="/"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    const trigger = screen.getByRole('button', { name: /ご案内/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const submenu = screen.getByRole('list', { name: 'ご案内のサブメニュー' });
    expect(trigger).toHaveAttribute('aria-controls', submenu.id);
  });

  test('現在地は aria-current と親項目の色のインジケーターで伝わる', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/announcements"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    const link = screen.getByRole('link', { name: 'お知らせ' });
    expect(link).toHaveAttribute('aria-current', 'page');
    const indicator = link.querySelector('span[aria-hidden="true"]');
    expect(indicator).toHaveClass('bg-warning', 'opacity-100', 'scale-x-100');
  });

  test('現在地でない行はインジケーターを描画せず、ラベルだけを行の縦中央に置く', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/announcements"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    // お知らせ (現在地) はインジケーターを持つが、隣の荒牧祭について (現在地でない) は持たない
    // (aria-hidden な span は開閉アイコンとも共通のため、インジケーター特有の h-[2px] クラスで絞る)
    const nonActiveLink = screen.getByRole('link', { name: '荒牧祭について' });
    expect(nonActiveLink.querySelector('.h-\\[2px\\]')).toBeNull();

    // 子項目を持つ親行 (現在地でない協賛) も同様。開閉アイコン自身は残る
    const nonActiveButton = screen.getByRole('button', { name: /協賛/ });
    expect(nonActiveButton.querySelector('.h-\\[2px\\]')).toBeNull();
    expect(
      nonActiveButton.querySelectorAll('span[aria-hidden="true"]'),
    ).toHaveLength(1);
  });

  test('子項目だけを持つ親は、子項目が現在地のとき aria-current を持つ', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/access"
        idPrefix="test"
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /ご案内/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('項目の選択で onNavigate を呼ぶ (親・子とも)', () => {
    const onNavigate = vi.fn();
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/"
        idPrefix="test"
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: '荒牧祭について' }));
    expect(onNavigate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /ご案内/ }));
    fireEvent.click(screen.getByRole('link', { name: 'アクセス' }));
    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  test('aria-controls の id は idPrefix を含み呼び出し元ごとに衝突しない', () => {
    render(
      <NavigationMenuRows
        items={navigationItemsByPhase.pre_event}
        pathname="/"
        idPrefix="map-menu"
        onNavigate={() => {}}
      />,
    );

    const trigger = screen.getByRole('button', { name: /ご案内/ });
    expect(trigger.getAttribute('aria-controls')).toContain('map-menu');
  });
});
