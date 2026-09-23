import { render, screen, within } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { AnnouncementsList } from './announcements-list';
import type { AnnouncementSummary } from '@/lib/home-page-types';

function makeAnnouncement(
  overrides: Partial<AnnouncementSummary> & Pick<AnnouncementSummary, 'id'>,
): AnnouncementSummary {
  return {
    title: `Notice ${overrides.id}`,
    body: '<p>Body</p>',
    publishedAt: '2026-07-10T00:00:00.000Z',
    attachments: [],
    ...overrides,
  };
}

describe('AnnouncementsList', () => {
  const announcements: AnnouncementSummary[] = [
    makeAnnouncement({
      id: 1,
      title: 'Notice 1',
      publishedAt: '2026-07-10T00:00:00.000Z',
    }),
    makeAnnouncement({
      id: 2,
      title: 'Notice 2',
      publishedAt: '2026-09-22T00:00:00.000Z',
    }),
  ];

  test('公開日とタイトルを 1 件 1 リンクの行として表示する (表組みではない)', () => {
    render(<AnnouncementsList announcements={announcements} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const link1 = within(items[0]).getByRole('link');
    expect(link1).toHaveAttribute('href', '/announcements/1');
    // 日付とタイトルが同じリンクの中にあり、別々の選択領域にならない (要件 13.9)
    expect(within(link1).getByText('Notice 1')).toBeInTheDocument();
    expect(within(link1).getByText('2026年7月10日')).toBeInTheDocument();
  });

  test('公開日は「2026年9月22日」の形式 (ゼロ埋めなし) で機械可読な日時を持つ (要件 13.8)', () => {
    render(<AnnouncementsList announcements={announcements} />);

    const time = screen.getByText('2026年9月22日');
    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', '2026-09-22T00:00:00.000Z');
  });

  test('渡された順序をそのまま描画する (並び順の決定は呼び出し側の責務)', () => {
    render(<AnnouncementsList announcements={announcements} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Notice 1')).toBeInTheDocument();
    expect(within(items[1]).getByText('Notice 2')).toBeInTheDocument();
  });

  test('limit を超えるとき右寄せの「お知らせ一覧へ」導線を表示する (要件 13.4)', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeAnnouncement({ id: i + 1 }),
    );

    render(<AnnouncementsList announcements={many} limit={5} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(screen.queryByText('Notice 6')).not.toBeInTheDocument();

    const moreLink = screen.getByRole('link', { name: /お知らせ一覧へ/ });
    expect(moreLink).toHaveAttribute('href', '/announcements');
    // ラベルは color/primary, アイコンは color/text (Figma 156:779/156:781 で別色)
    expect(within(moreLink).getByText('お知らせ一覧へ')).toHaveClass(
      'text-primary',
    );
    const icon = within(moreLink).getByTestId('icon-chevron-right');
    expect(icon).toHaveClass('text-text');
    expect(icon).not.toHaveClass('text-primary');
  });

  test('limit 未満のときは一覧への導線を出さない', () => {
    render(<AnnouncementsList announcements={announcements} limit={5} />);

    expect(
      screen.queryByRole('link', { name: /お知らせ一覧へ/ }),
    ).not.toBeInTheDocument();
  });

  test('limit が無いときは件数に関わらず全件描画し、導線も出さない', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      makeAnnouncement({ id: i + 1 }),
    );

    render(<AnnouncementsList announcements={many} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(
      screen.queryByRole('link', { name: /お知らせ一覧へ/ }),
    ).not.toBeInTheDocument();
  });

  test('0 件のとき「お知らせはありません」を表示しリストを描画しない (要件 13.5)', () => {
    render(<AnnouncementsList announcements={[]} />);

    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
