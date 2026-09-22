import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { NoticesSection } from './notices-section';
import type { AnnouncementSummary } from '@/lib/home-page-types';

function announcement(
  overrides: Partial<AnnouncementSummary> = {},
): AnnouncementSummary {
  return {
    id: 1,
    title: 'お知らせ',
    body: '',
    publishedAt: '2026-07-01',
    attachments: [],
    ...overrides,
  };
}

describe('NoticesSection', () => {
  test('固定文言「お知らせ」の見出しの下に新しい順で最大5件を表示する (Figma 107:6)', () => {
    const announcements = Array.from({ length: 7 }, (_, i) =>
      announcement({ id: i, title: `お知らせ${i}` }),
    );

    render(<NoticesSection announcements={announcements} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'お知らせ' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  test('上限を超える件数があるとき /announcements への導線を添える', () => {
    const announcements = Array.from({ length: 6 }, (_, i) =>
      announcement({ id: i }),
    );

    render(<NoticesSection announcements={announcements} />);

    expect(
      screen.getByRole('link', { name: /お知らせ一覧へ/ }),
    ).toHaveAttribute('href', '/announcements');
  });

  test('0件のとき「お知らせはありません」を表示する', () => {
    render(<NoticesSection announcements={[]} />);

    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
  });
});
