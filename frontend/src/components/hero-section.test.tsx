import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  test('renders heroMessageHtml and multiple heroImageUrls', () => {
    render(
      <HeroSection
        heroImageUrls={[
          'https://example.com/hero1.jpg',
          'https://example.com/hero2.jpg',
        ]}
        heroMessageHtml="<h1>Welcome</h1>"
      />,
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://example.com/hero1.jpg');
    expect(images[1]).toHaveAttribute('src', 'https://example.com/hero2.jpg');

    // CMS側見出しはページ内他のh1と競合しないよう1段階下げてh2として出力される
    const heading = screen.getByRole('heading', { level: 2, name: 'Welcome' });
    expect(heading).toBeInTheDocument();
  });

  test('does not render img when heroImageUrls is empty', () => {
    render(<HeroSection heroImageUrls={[]} heroMessageHtml="<h1>Welcome</h1>" />);

    const img = screen.queryByRole('img');
    expect(img).not.toBeInTheDocument();
  });
});
