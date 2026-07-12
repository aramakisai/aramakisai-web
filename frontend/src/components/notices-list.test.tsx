import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { NoticesList } from './notices-list';

describe('NoticesList', () => {
  const notices = [
    { id: 1, title: 'Notice 1', body: '<p>Body 1</p>', publishedAt: '2026-07-10' },
    { id: 2, title: 'Notice 2', body: '<p>Body 2</p>', publishedAt: '2026-07-11' },
  ];

  test('renders notices array', () => {
    render(<NoticesList notices={notices} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Notice 1' })).toBeInTheDocument();
    expect(screen.getByText('Body 1')).toBeInTheDocument();
    expect(screen.getByText('2026-07-10')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 3, name: 'Notice 2' })).toBeInTheDocument();
    expect(screen.getByText('Body 2')).toBeInTheDocument();
    expect(screen.getByText('2026-07-11')).toBeInTheDocument();
  });

  test('renders placeholder when notices array is empty', () => {
    render(<NoticesList notices={[]} />);
    expect(screen.getByText('お知らせはありません')).toBeInTheDocument();
  });
});
