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

  test('drops h1 tag keeping its text, keeps h2〜h4 as-is and drops h5/h6 tags', () => {
    const { container } = render(
      <RichText html="<h1>見出し1</h1><h2>見出し2</h2><h3>見出し3</h3><h4>見出し4</h4><h5>見出し5</h5>" />,
    );

    expect(container.querySelector('h1')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveTextContent('見出し1');
    expect(
      screen.getByRole('heading', { level: 2, name: '見出し2' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 3, name: '見出し3' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: '見出し4' }),
    ).toBeInTheDocument();
    expect(container.querySelector('h5')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveTextContent('見出し5');
  });

  test('keeps rich-text component HTML (image row, callout, button link, table)', () => {
    const { container } = render(
      <RichText
        html={
          '<div class="rt-image-row" data-count="2"><figure><figcaption>左</figcaption><img data-media-id="1" alt="左"></figure><figure><img data-media-id="2" alt="右"></figure></div>' +
          '<aside class="rt-callout" data-kind="caution"><p>注意<br>です</p></aside>' +
          '<p class="rt-button"><a href="https://example.com">詳細</a></p>' +
          '<div class="rt-table"><table><tbody><tr><th colspan="2" rowspan="3">見出し</th><td>値</td></tr></tbody></table></div>'
        }
      />,
    );

    const row = container.querySelector('div.rt-image-row');
    expect(row).toHaveAttribute('data-count', '2');
    expect(row?.querySelectorAll('figure')).toHaveLength(2);
    expect(row?.querySelector('figcaption')).toHaveTextContent('左');
    expect(row?.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/assets/1',
    );
    expect(container.querySelector('aside.rt-callout')).toHaveAttribute(
      'data-kind',
      'caution',
    );
    expect(container.querySelector('aside.rt-callout p br')).not.toBeNull();
    expect(container.querySelector('p.rt-button a')).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(
      container.querySelector('div.rt-table table tbody tr'),
    ).not.toBeNull();
    const th = container.querySelector('th');
    expect(th).toHaveAttribute('colspan', '2');
    expect(th).toHaveAttribute('rowspan', '3');
    expect(container.querySelector('td')).toHaveTextContent('値');
  });

  test('drops classes and attributes outside the allow list', () => {
    const { container } = render(
      <RichText html='<div class="evil rt-table" style="color:red" data-count="9"><table class="x"><tbody><tr><td colspan="2" onclick="x()" class="y">a</td></tr></tbody></table></div><aside class="foo" data-kind="x"><p class="rt-button z">b</p></aside>' />,
    );

    const inner = container.querySelector('.rich-text-body > div');
    expect(inner?.getAttribute('class')).toBe('rt-table');
    expect(inner).not.toHaveAttribute('style');
    expect(container.querySelector('table')).not.toHaveAttribute('class');
    const td = container.querySelector('td');
    expect(td).not.toHaveAttribute('class');
    expect(td).not.toHaveAttribute('onclick');
    expect(container.querySelector('aside')).not.toHaveAttribute('class');
    expect(container.querySelector('aside p')?.getAttribute('class')).toBe(
      'rt-button',
    );
  });

  test('unwraps the payload-richtext container div so blocks stay direct children', () => {
    const { container } = render(
      <RichText html='<div class="payload-richtext"><h2>見出し</h2><p>本文</p><div class="rt-table"><table><tbody><tr><td>a</td></tr></tbody></table></div></div>' />,
    );

    const body = container.querySelector('.rich-text-body');
    expect(
      Array.from(body?.children ?? []).map((el) => el.tagName.toLowerCase()),
    ).toEqual(['h2', 'p', 'div']);
    expect(body?.lastElementChild).toHaveClass('rt-table');
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
