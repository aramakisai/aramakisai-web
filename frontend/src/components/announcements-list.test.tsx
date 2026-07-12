import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { AnnouncementsList } from './announcements-list';

describe('AnnouncementsList', () => {
  const announcements = [
    {
      id: 1,
      title: 'Notice 1',
      body: '<p>Body 1</p>',
      publishedAt: '2026-07-10',
    },
    {
      id: 2,
      title: 'Notice 2',
      body: '<p>Body 2</p>',
      publishedAt: '2026-07-11',
    },
  ];

  test('renders announcements array', () => {
    render(<AnnouncementsList announcements={announcements} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Notice 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Body 1')).toBeInTheDocument();
    expect(screen.getByText('2026-07-10')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 3, name: 'Notice 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Body 2')).toBeInTheDocument();
    expect(screen.getByText('2026-07-11')).toBeInTheDocument();
  });

  test('renders placeholder when announcements array is empty', () => {
    render(<AnnouncementsList announcements={[]} />);
    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
  });
});
