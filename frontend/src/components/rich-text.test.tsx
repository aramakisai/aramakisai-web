import { render, screen } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { RichText } from './rich-text';

vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) =>
    id ? `https://example.com/assets/${id}` : null,
}));

describe('RichText', () => {
  test('renders allowed tags and strips scripts, iframes and disallowed attributes', () => {
    const dirtyHtml = `
      <h2>Title</h2>
      <p>This is a <strong>strong</strong> and <em>em</em> text.</p>
      <script>alert("XSS")</script>
      <iframe src="https://evil.com"></iframe>
      <a href="https://example.com" target="_blank" onclick="alert(1)">Link</a>
      <ul>
        <li>Item 1</li>
      </ul>
      <ol>
        <li>Item 2</li>
      </ol>
      <blockquote>Quote</blockquote>
      <hr>
    `;

    const { container } = render(
      <RichText html={dirtyHtml} className="my-rich-text" />,
    );

    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('<iframe');
    expect(container.innerHTML).not.toContain('onclick');

    expect(
      screen.getByRole('heading', { level: 2, name: 'Title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('strong').tagName).toBe('STRONG');
    expect(screen.getByText('em').tagName).toBe('EM');

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('target');

    expect(container.querySelector('ul')).toBeInTheDocument();
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Quote').tagName).toBe('BLOCKQUOTE');
    expect(container.querySelector('hr')).toBeInTheDocument();

    expect(container.firstChild).toHaveClass('my-rich-text');
  });

  test('renders h1 as h2 and keeps h2〜h4 as-is, dropping h5/h6 tags', () => {
    const { container } = render(
      <RichText html="<h1>見出し1</h1><h2>見出し2</h2><h3>見出し3</h3><h4>見出し4</h4><h5>見出し5</h5>" />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: '見出し1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '見出し2' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: '見出し3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: '見出し4' }),
    ).toBeInTheDocument();
    expect(container.querySelector('h5')).not.toBeInTheDocument();
    expect(screen.getByText('見出し5')).toBeInTheDocument();
  });

  test('builds img src from data-media-id via toAssetUrl and keeps alt', () => {
    render(<RichText html='<img data-media-id="42" alt="説明文">' />);

    const img = screen.getByAltText('説明文');
    expect(img).toHaveAttribute('src', 'https://example.com/assets/42');
    expect(img).toHaveAttribute('data-media-id', '42');
  });

  test('drops img tag entirely when data-media-id is missing', () => {
    const { container } = render(
      <RichText html='<img src="https://evil.com/x.png" alt="不正">' />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  test('allows underline/line-through decoration via span style but strips other styles', () => {
    const { container } = render(
      <RichText html='<p><span style="text-decoration: underline;">下線</span><span style="text-decoration: line-through;">取消線</span><span style="color: red; text-decoration: underline;">混在</span></p>' />,
    );

    const spans = container.querySelectorAll('span');
    expect(spans[0]).toHaveAttribute('style', 'text-decoration:underline');
    expect(spans[1]).toHaveAttribute('style', 'text-decoration:line-through');
    expect(spans[2]).toHaveAttribute('style', 'text-decoration:underline');
    expect(spans[2].getAttribute('style')).not.toContain('color');
  });

  test('applies the rich-text-body class used for typography scoping', () => {
    const { container } = render(<RichText html="<p>本文</p>" />);
    expect(container.firstChild).toHaveClass('rich-text-body');
  });

  test('allows long unbroken content to wrap without overflowing its container', () => {
    const { container } = render(
      <RichText
        html="<p>https://example.com/a-very-long-unbroken-path-that-must-wrap</p>"
        className="max-w-none"
      />,
    );

    expect(container.firstChild).toHaveClass(
      'min-w-0',
      'break-words',
      '[overflow-wrap:anywhere]',
      'max-w-none',
    );
  });
});
