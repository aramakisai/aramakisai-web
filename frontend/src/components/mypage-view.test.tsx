import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MypageView } from './mypage-view';
import type { MypageStampTarget } from '@/lib/stamp-progress';

const AREAS = [
  { id: 1, name: '中央エリア' },
  { id: 2, name: '南エリア' },
  { id: 3, name: '空エリア' },
];
const LABELS = {
  exhibit: '展示',
  vendor: '出店',
  other: 'その他企画',
} as const;
const TARGETS: MypageStampTarget[] = [
  { id: 10, category: 'exhibit', displayName: '展示A', areaId: 1 },
  { id: 11, category: 'vendor', displayName: 'クレープ', areaId: 1 },
  { id: 12, category: 'other', displayName: '休憩所', areaId: 2 },
  { id: 13, category: 'exhibit', displayName: '野良', areaId: null },
];

function save(refs: Array<[number, string]>) {
  window.localStorage.setItem(
    'aramakisai_mypage',
    JSON.stringify({
      version: 1,
      lists: {
        stamps: refs.map(([id, category], i) => ({
          id,
          category,
          savedAt: `2026-10-24T0${i}:00:00.000Z`,
        })),
      },
    }),
  );
}

describe('MypageView', () => {
  beforeEach(() => window.localStorage.clear());

  it('スタンプが無いときは空表示を出し、エリアは0%で並ぶ', () => {
    render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(2);
    expect(screen.queryByText('その他')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'マイページ',
    );
  });

  it('取得率を表示し、エリアは既定で閉じている', () => {
    save([[10, 'exhibit']]);
    const { container } = render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.queryByText('スタンプはありません')).not.toBeInTheDocument();
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(1);
    expect(details[0]).not.toHaveAttribute('open');
    const bar = container.querySelector('[data-testid="progress-fill"]');
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('行は企画詳細ページへのリンクで、カテゴリを示す', () => {
    save([[11, 'vendor']]);
    render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    const link = screen.getByRole('link', { name: /クレープ/ });
    expect(link).toHaveAttribute('href', '/exhibitions/11/vendor');
    expect(within(link).getByText('出店')).toBeInTheDocument();
  });

  it('「その他」は取得率なしで、取得があるときだけ出る', () => {
    save([[13, 'exhibit']]);
    render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    const summary = screen.getByText('その他').closest('summary')!;
    expect(summary).not.toHaveTextContent('%');
    expect(screen.getByRole('link', { name: /野良/ })).toHaveAttribute(
      'href',
      '/exhibitions/13/exhibit',
    );
  });

  it('対象に無い保存済みスタンプは無視する', () => {
    save([[999, 'exhibit']]);
    render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
  });

  it('保存不可でも空表示で落ちない', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('denied');
    };
    try {
      render(
        <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
      );
      expect(screen.getByText('スタンプはありません')).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  it('PC案内を本体と別に持ち、QR画像のaltを持つ', () => {
    render(
      <MypageView targets={TARGETS} areas={AREAS} categoryLabels={LABELS} />,
    );
    expect(
      screen.getByText('マイページはスマートフォンでご利用ください'),
    ).toBeInTheDocument();
    expect(screen.getByAltText('マイページのQRコード')).toHaveAttribute(
      'src',
      expect.stringContaining('qr-mypage.svg'),
    );
    expect(screen.getByAltText('マイページのQRコード')).toHaveClass(
      'size-[174px]',
    );
  });
});
