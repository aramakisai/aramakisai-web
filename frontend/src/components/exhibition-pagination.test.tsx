import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ExhibitionPagination } from './exhibition-pagination';

const hrefForPage = (page: number) => `/exhibitions?page=${page}`;

describe('ExhibitionPagination', () => {
  test('総ページ数が 1 以下のときは何も表示しない', () => {
    const { container } = render(
      <ExhibitionPagination page={1} pageCount={1} hrefForPage={hrefForPage} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('総ページ数分のページ番号リンクを表示し、現在ページを示す', () => {
    render(<ExhibitionPagination page={2} pageCount={3} hrefForPage={hrefForPage} />);

    const current = screen.getByRole('link', { name: '2' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', '/exhibitions?page=2');

    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/exhibitions?page=1',
    );
    expect(screen.getByRole('link', { name: '3' })).toHaveAttribute(
      'href',
      '/exhibitions?page=3',
    );
  });

  test('先頭ページでは前のページへのリンクを表示しない', () => {
    render(<ExhibitionPagination page={1} pageCount={3} hrefForPage={hrefForPage} />);
    expect(screen.queryByRole('link', { name: '前のページ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '次のページ' })).toHaveAttribute(
      'href',
      '/exhibitions?page=2',
    );
  });

  test('最終ページでは次のページへのリンクを表示しない', () => {
    render(<ExhibitionPagination page={3} pageCount={3} hrefForPage={hrefForPage} />);
    expect(screen.queryByRole('link', { name: '次のページ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前のページ' })).toHaveAttribute(
      'href',
      '/exhibitions?page=2',
    );
  });
});
