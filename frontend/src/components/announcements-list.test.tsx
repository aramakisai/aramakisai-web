import { render, screen, within } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { AnnouncementsList } from './announcements-list';

describe('AnnouncementsList', () => {
  const announcements = [
    {
      id: 1,
      title: 'Notice 1',
      body: '<p>Body 1</p>',
      publishedAt: '2026-07-10',
      attachments: [],
    },
    {
      id: 2,
      title: 'Notice 2',
      body: '<p>Body 2</p>',
      publishedAt: '2026-07-11',
      attachments: [],
    },
  ];

  test('renders announcements array as a table', () => {
    render(<AnnouncementsList announcements={announcements} />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const columnHeaders = screen.getAllByRole('columnheader');
    expect(columnHeaders[0]).toHaveTextContent('公開日時');
    expect(columnHeaders[1]).toHaveTextContent('タイトル');

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3); // 1 header row + 2 data rows

    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText('2026-07-10')).toBeInTheDocument();
    const link1 = within(firstDataRow).getByRole('link', { name: 'Notice 1' });
    expect(link1).toBeInTheDocument();
    expect(link1).toHaveAttribute('href', '/announcements/1');

    const secondDataRow = rows[2];
    expect(within(secondDataRow).getByText('2026-07-11')).toBeInTheDocument();
    const link2 = within(secondDataRow).getByRole('link', { name: 'Notice 2' });
    expect(link2).toBeInTheDocument();
    expect(link2).toHaveAttribute('href', '/announcements/2');

    expect(screen.queryByText('Body 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Body 2')).not.toBeInTheDocument();
  });

  test('renders placeholder when announcements array is empty', () => {
    render(<AnnouncementsList announcements={[]} />);
    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
  });
});
