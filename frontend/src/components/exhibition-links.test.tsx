import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExhibitionLinks } from './exhibition-links';
import type { ExhibitionLink } from '@/lib/exhibitions';

describe('ExhibitionLinks', () => {
  it('renders 3 kinds of links in registered order with logos, accessible names and new-tab safety', () => {
    const links: readonly ExhibitionLink[] = [
      { platform: 'x', url: 'https://x.com/aramaki' },
      { platform: 'instagram', url: 'https://instagram.com/aramaki' },
      { platform: 'website', url: 'https://aramaki.example.com' },
    ];
    render(<ExhibitionLinks links={links} />);

    const anchors = screen.getAllByRole('link');
    expect(anchors).toHaveLength(3);

    expect(anchors[0]).toHaveAccessibleName('X');
    expect(anchors[0]).toHaveAttribute('href', 'https://x.com/aramaki');
    expect(anchors[0].querySelector('[data-testid="icon-x"]')).not.toBeNull();

    expect(anchors[1]).toHaveAccessibleName('Instagram');
    expect(
      anchors[1].querySelector('[data-testid="icon-instagram"]'),
    ).not.toBeNull();

    expect(anchors[2]).toHaveAccessibleName('公式サイト');
    expect(
      anchors[2].querySelector('[data-testid="icon-link"]'),
    ).not.toBeNull();
    // ホームページは未知サービス扱いにせず、文字ラベルを出さない
    expect(anchors[2]).not.toHaveTextContent('website');

    for (const anchor of anchors) {
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor).toHaveAttribute(
        'rel',
        expect.stringContaining('noopener'),
      );
    }
  });

  it('renders nothing when there are no links', () => {
    const { container } = render(<ExhibitionLinks links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
