import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { RichText } from './rich-text';

describe('RichText', () => {
  test('renders sanitized HTML, removing scripts and iframes but keeping allowed tags', () => {
    const dirtyHtml = `
      <h1>Title</h1>
      <p>This is a <strong>strong</strong> text.</p>
      <script>alert("XSS")</script>
      <iframe src="https://evil.com"></iframe>
      <a href="https://example.com" target="_blank">Link</a>
      <ul>
        <li>Item 1</li>
      </ul>
    `;

    const { container } = render(<RichText html={dirtyHtml} className="my-rich-text" />);

    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('<iframe');

    const heading = screen.getByRole('heading', { level: 1, name: 'Title' });
    expect(heading).toBeInTheDocument();

    const strong = screen.getByText('strong');
    expect(strong.tagName).toBe('STRONG');

    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    // Sanitize should add/keep target blank but we also want rel="noopener noreferrer"
    // However, exact match might be tricky, let's just check the attribute.
    // Our spec says: rel="noopener noreferrer" を強制付与
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    expect(container.firstChild).toHaveClass('my-rich-text');
  });
});
