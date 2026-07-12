import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { SandboxedEmbed } from './sandboxed-embed';

describe('SandboxedEmbed', () => {
  test('does not render anything when url is empty or undefined', () => {
    const { container: containerEmpty } = render(<SandboxedEmbed url="" title="Empty" />);
    expect(containerEmpty.firstChild).toBeNull();

    const { container: containerNull } = render(<SandboxedEmbed url={null} title="Null" />);
    expect(containerNull.firstChild).toBeNull();

    const { container: containerUndefined } = render(<SandboxedEmbed url={undefined} title="Undefined" />);
    expect(containerUndefined.firstChild).toBeNull();
  });

  test('renders an iframe with correct attributes when url is provided', () => {
    render(<SandboxedEmbed url="https://example.com/embed" title="Example Embed" className="my-class" />);

    const iframe = screen.getByTitle('Example Embed');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('src', 'https://example.com/embed');
    expect(iframe).toHaveClass('my-class');

    // Check sandbox attributes
    const sandboxAttr = iframe.getAttribute('sandbox');
    expect(sandboxAttr).not.toBeNull();
    const sandboxTokens = sandboxAttr?.split(' ') || [];
    expect(sandboxTokens).toContain('allow-scripts');
    expect(sandboxTokens).toContain('allow-popups');
    expect(sandboxTokens).toContain('allow-popups-to-escape-sandbox');
    expect(sandboxTokens).not.toContain('allow-same-origin');
  });
});
