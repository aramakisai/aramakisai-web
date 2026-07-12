import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { SnsLinks } from './sns-links';

describe('SnsLinks', () => {
  const snsLinks = [
    { platform: 'Twitter', url: 'https://twitter.com/example' },
    { platform: 'Instagram', url: 'https://instagram.com/example' },
  ];

  test('renders sns links array', () => {
    render(<SnsLinks snsLinks={snsLinks} />);

    const twitterLink = screen.getByRole('link', { name: 'Twitter' });
    expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/example');

    const instagramLink = screen.getByRole('link', { name: 'Instagram' });
    expect(instagramLink).toHaveAttribute(
      'href',
      'https://instagram.com/example',
    );
  });

  test('renders nothing when array is empty', () => {
    const { container } = render(<SnsLinks snsLinks={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
